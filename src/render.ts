import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';
import { resolveAssetPath } from './core/assets.ts';
import * as fontkit from 'fontkit';
import { canonicalWeightOf, DEFAULTS, textStyleOf, weightValueOf } from './core/defaults.ts';
import type {
  DeckDefinition,
  Diagnostic,
  Dimensions,
  FontFace,
  FontWeight,
  LayoutEnv,
  LineBreaks,
  PositionedDeck,
  PositionedNode,
  PositionedText,
  PreviewOptions,
  RenderOptions,
  RenderResult,
  SlideSize,
} from './core/types.ts';
import { emitPptx, type EmitOptions } from './emit/index.ts';
import {
  DEFAULT_FONTS,
  eotOf,
  fontFamilyMapOf,
  fontLabelOf,
  fsTypeOf,
  isEmbeddable,
  isTrueTypeFont,
  normalizeFamily,
  resolveFontFaces,
  type FileFontFace,
} from './fonts/index.ts';
import { cssNotEmittedOf, fitDeck } from './fit/index.ts';
import { buildOverview, slideToSvg, svgToPng } from './preview/index.ts';
import { createResolveEnv, resolveDeck, type ResolveEnv } from './resolve/index.ts';
import { createContext, resolveSize } from './sizes.ts';
import { createFontkitMeasurer, createFontRegistry } from './text/index.ts';

/** Tudo que é derivado das opções uma única vez e vale para todos os tamanhos. */
interface RenderSettings {
  readonly baseDir: string;
  readonly debug: boolean;
  readonly lang: string;
  readonly lineBreaks: LineBreaks;
  readonly includePositioned: boolean;
  /** Faces já resolvidas (todas com arquivo). */
  readonly fonts: readonly FileFontFace[];
  /** Faces pedidas sem arquivo que não estão no sistema ("Inter bold"). */
  readonly fontsMissing: readonly string[];
  readonly embedFonts: boolean;
  readonly preview: PreviewOptions | false;
  readonly env: LayoutEnv;
  /** M12: leitura de assets no resolve (SVG dos ícones), relativa ao baseDir. */
  readonly resolveEnv: ResolveEnv;
}

const readImageSize =
  (baseDir: string) =>
  (src: string): Dimensions => {
    const { width, height } = imageSize(readFileSync(resolveAssetPath(baseDir, src)));
    return { width: width ?? 0, height: height ?? 0 };
  };

const settingsOf = (options: RenderOptions): RenderSettings => {
  const baseDir = options.baseDir ?? process.cwd();
  const { faces: fonts, missing: fontsMissing } = resolveFontFaces(options.fonts ?? DEFAULT_FONTS);
  const measureText = createFontkitMeasurer(createFontRegistry(fonts), { safety: options.textSafety ?? DEFAULTS.textSafety });
  return {
    baseDir,
    debug: options.debug ?? false,
    lang: options.lang ?? DEFAULTS.lang,
    lineBreaks: options.lineBreaks ?? DEFAULTS.lineBreaks,
    includePositioned: options.includePositioned ?? false,
    fonts,
    fontsMissing,
    embedFonts: options.embedFonts ?? DEFAULTS.embedFonts,
    preview: options.preview ?? { mode: 'native', width: DEFAULTS.preview.width },
    // M11: o min-content do grid precisa da mesma folga do medidor.
    env: { measureText, imageSize: readImageSize(baseDir), textSafety: options.textSafety ?? DEFAULTS.textSafety },
    resolveEnv: createResolveEnv(baseDir),
  };
};

/** Selo do overview: o diagnóstico mais grave do slide (info não aparece). */
const badgeOf = (diagnostics: readonly Diagnostic[], slideNumber: number): 'error' | 'warning' | undefined => {
  const severities = diagnostics.filter((d) => d.slide === slideNumber).map((d) => d.severity);
  if (severities.includes('error')) return 'error';
  if (severities.includes('warning')) return 'warning';
  return undefined;
};

const renderPreview = (
  deck: PositionedDeck,
  diagnostics: readonly Diagnostic[],
  settings: RenderSettings,
  preview: PreviewOptions,
) => {
  const widthPx = preview.width ?? DEFAULTS.preview.width;
  const fontFiles = settings.fonts.map((face) => face.file);
  const svgOptions = {
    widthPx,
    debug: settings.debug,
    baseDir: settings.baseDir,
    fontFamilyMap: fontFamilyMapOf(settings.fonts),
    lang: settings.lang,
  };
  const slides = deck.slides.map((slide) => svgToPng(slideToSvg(slide, deck.size, svgOptions), { widthPx, fontFiles }));
  const overview = buildOverview(
    slides.map((png, index) => ({ png, number: index + 1, badge: badgeOf(diagnostics, index + 1) })),
    { fontFiles },
  );
  return { slides, overview };
};

// ───────────────────────── Embed de fontes ─────────────────────────

/** Face como o emissor embute: EOT pronto, o emissor não lê arquivo. */
type EmbeddedFont = NonNullable<EmitOptions['embedFonts']>[number];

interface EmbedPlan {
  readonly fonts: readonly EmbeddedFont[];
  readonly diagnostics: readonly Diagnostic[];
}

interface FaceUse {
  readonly family: string;
  readonly weight: FontWeight;
  readonly italic: boolean;
}

const textNodesOf = (nodes: readonly PositionedNode[]): readonly PositionedText[] =>
  nodes.flatMap((node) => {
    if (node.kind === 'text') return [node];
    if (node.kind === 'box') return textNodesOf(node.children);
    return [];
  });

// `runs` pode faltar em árvores de antes do M8-A: vale um run com o estilo do próprio Text.
// M13: o peso é o da face que o medidor usou (um 500 sem face embute a de 400 ou 600 escolhida).
const faceUsesOf = (node: PositionedText): readonly FaceUse[] => {
  const style = textStyleOf(node.props);
  const runs: readonly Pick<FaceUse, 'weight' | 'italic'>[] = node.runs ?? [{ weight: style.weight, italic: style.italic }];
  return runs.map((run, index) => ({ family: style.family, weight: node.text.faces?.[index]?.weight ?? run.weight, italic: run.italic }));
};

const isFaceOf = (face: FontFace, use: FaceUse): boolean =>
  normalizeFamily(face.family) === normalizeFamily(use.family) &&
  weightValueOf(face.weight) === weightValueOf(use.weight) &&
  (face.italic ?? false) === use.italic;

// Mesma regra do registro de medição: itálico ausente cai para a face reta do mesmo peso.
const registeredFaceOf = (fonts: readonly FileFontFace[], use: FaceUse): FileFontFace | undefined =>
  fonts.find((face) => isFaceOf(face, use)) ??
  (use.italic ? fonts.find((face) => isFaceOf(face, { ...use, italic: false })) : undefined);

const DEFAULT_FONT_FILES: ReadonlySet<string> = new Set(DEFAULT_FONTS.map((face) => face.file));

// A Liberation é emitida como "Arial": embuti-la trocaria a Arial de verdade do leitor pela substituta.
const isDefaultArial = (face: FileFontFace): boolean =>
  DEFAULT_FONT_FILES.has(face.file) && normalizeFamily(face.family) === normalizeFamily(DEFAULTS.text.font);

/** Faces registradas que algum trecho do deck usa, na ordem de registro. */
const usedFacesOf = (deck: PositionedDeck, fonts: readonly FileFontFace[]): readonly FileFontFace[] => {
  const used = new Set(
    deck.slides
      .flatMap((slide) => textNodesOf(slide.children))
      .flatMap(faceUsesOf)
      .map((use) => registeredFaceOf(fonts, use)),
  );
  return fonts.filter((face) => used.has(face) && !isDefaultArial(face));
};

type EmbedCheck = { readonly font: EmbeddedFont } | { readonly problem: string };

// O PowerPoint recusa o arquivo inteiro se não conseguir instalar uma fonte embutida,
// então só sai EOT de TrueType de uma face só e com licença que permite embed. IO de borda.
const embedCheckOf = (face: FileFontFace): EmbedCheck => {
  const data = readFileSync(face.file);
  const label = fontLabelOf(face);
  if (!isTrueTypeFont(data)) {
    return { problem: `A fonte "${label}" não é um TrueType de uma face só (.otf CFF ou coleção .ttc) e não foi embutida.` };
  }
  if (!isEmbeddable(fsTypeOf(data))) {
    return { problem: `A fonte "${label}" não permite embed (fsType restrito) e não foi embutida.` };
  }
  // M13: face fora de 400/700 vai sob o nome da própria face ("Inter SemiBold"), como regular: é esse o typeface dos runs.
  const canonical = canonicalWeightOf(face.weight);
  if (typeof canonical === 'number') {
    const family = faceFamilyNameOf(face);
    return { font: { family, weight: 'regular', italic: face.italic ?? false, eot: eotOf(data, family) } };
  }
  return { font: { family: face.family, weight: canonical, italic: face.italic ?? false, eot: eotOf(data, face.family) } };
};

/** Nome de família (name ID 1) da face no arquivo. */
const faceFamilyNameOf = (face: FileFontFace): string => {
  const loaded = face.postscriptName ? fontkit.openSync(face.file, face.postscriptName) : fontkit.openSync(face.file);
  const font = 'fonts' in loaded ? loaded.fonts[0] : loaded;
  return font?.familyName ?? face.family;
};

const notEmbeddable = (size: string, message: string): Diagnostic => ({
  severity: 'warning',
  code: 'font-not-embeddable',
  size,
  slide: 0,
  path: '',
  message,
});

const embedPlanOf = (deck: PositionedDeck, settings: RenderSettings): EmbedPlan => {
  if (!settings.embedFonts) return { fonts: [], diagnostics: [] };
  const checks = usedFacesOf(deck, settings.fonts).map(embedCheckOf);
  return {
    fonts: checks.flatMap((check) => ('font' in check ? [check.font] : [])),
    diagnostics: checks.flatMap((check) => ('problem' in check ? [notEmbeddable(deck.size.name, check.problem)] : [])),
  };
};

const renderSize = async (deck: DeckDefinition, size: SlideSize, settings: RenderSettings): Promise<RenderResult> => {
  const ctx = createContext(size);
  const fitted = fitDeck({ deck: resolveDeck(deck(ctx), ctx, settings.resolveEnv), size, env: settings.env });
  const { positioned } = fitted;
  const embed = embedPlanOf(positioned, settings);
  const buffer = await emitPptx(positioned, {
    debug: settings.debug,
    baseDir: settings.baseDir,
    lang: settings.lang,
    lineBreaks: settings.lineBreaks,
    embedFonts: embed.fonts,
  });
  // M11: propriedades CSS sem de/para para o PPTX viram warning aqui (uma vez por nó).
  const diagnostics = [...fitted.diagnostics, ...cssNotEmittedOf(positioned), ...embed.diagnostics];
  const result: RenderResult = {
    size: size.name,
    buffer,
    diagnostics,
    ...(settings.includePositioned ? { positioned } : {}),
    ...(settings.fontsMissing.length > 0 ? { fontsMissing: settings.fontsMissing } : {}),
  };
  if (settings.preview === false) return result;
  return { ...result, preview: renderPreview(positioned, diagnostics, settings, settings.preview) };
};

/** API programática: nunca grava arquivo nem imprime. */
export const render = async (deck: DeckDefinition, options: RenderOptions = {}): Promise<RenderResult[]> => {
  const settings = settingsOf(options);
  const sizes = (options.sizes ?? ['16x9']).map(resolveSize);
  return Promise.all(sizes.map((size) => renderSize(deck, size, settings)));
};
