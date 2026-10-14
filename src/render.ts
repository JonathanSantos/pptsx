import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';
import { resolveAssetPath } from './core/assets.ts';
import { DEFAULTS } from './core/defaults.ts';
import type {
  DeckDefinition,
  Diagnostic,
  Dimensions,
  FontFace,
  LayoutEnv,
  LineBreaks,
  PositionedDeck,
  PreviewOptions,
  RenderOptions,
  RenderResult,
  ResolvedDeck,
  SlideSize,
} from './core/types.ts';
import { emitPptx } from './emit/index.ts';
import { DEFAULT_FONTS, fontFamilyMapOf } from './fonts.ts';
import { fitSlide } from './fit/index.ts';
import { buildOverview, slideToSvg, svgToPng } from './preview/index.ts';
import { resolveDeck } from './resolve/index.ts';
import { createContext, resolveSize } from './sizes.ts';
import { createFontkitMeasurer, createFontRegistry } from './text/index.ts';

/** Tudo que é derivado das opções uma única vez e vale para todos os tamanhos. */
interface RenderSettings {
  readonly baseDir: string;
  readonly debug: boolean;
  readonly lang: string;
  readonly lineBreaks: LineBreaks;
  readonly includePositioned: boolean;
  readonly fonts: readonly FontFace[];
  readonly preview: PreviewOptions | false;
  readonly env: LayoutEnv;
}

const readImageSize =
  (baseDir: string) =>
  (src: string): Dimensions => {
    const { width, height } = imageSize(readFileSync(resolveAssetPath(baseDir, src)));
    return { width: width ?? 0, height: height ?? 0 };
  };

const settingsOf = (options: RenderOptions): RenderSettings => {
  const baseDir = options.baseDir ?? process.cwd();
  const fonts = options.fonts ?? DEFAULT_FONTS;
  const measureText = createFontkitMeasurer(createFontRegistry(fonts), { safety: options.textSafety ?? DEFAULTS.textSafety });
  return {
    baseDir,
    debug: options.debug ?? false,
    lang: options.lang ?? DEFAULTS.lang,
    lineBreaks: options.lineBreaks ?? DEFAULTS.lineBreaks,
    includePositioned: options.includePositioned ?? false,
    fonts,
    preview: options.preview ?? { mode: 'native', width: DEFAULTS.preview.width },
    env: { measureText, imageSize: readImageSize(baseDir) },
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
  };
  const slides = deck.slides.map((slide) => svgToPng(slideToSvg(slide, deck.size, svgOptions), { widthPx, fontFiles }));
  const overview = buildOverview(
    slides.map((png, index) => ({ png, number: index + 1, badge: badgeOf(diagnostics, index + 1) })),
    { fontFiles },
  );
  return { slides, overview };
};

/** Layout + ajuste (loop de fit) de cada slide, já com os diagnósticos. */
const fitDeck = (deck: ResolvedDeck, size: SlideSize, env: LayoutEnv) => {
  const fitted = deck.slides.map((slide, slideIndex) => fitSlide({ slide, slideIndex, size, env }));
  const positioned: PositionedDeck = { size, slides: fitted.map((result) => result.slide) };
  return { positioned, diagnostics: fitted.flatMap((result) => result.diagnostics) };
};

const renderSize = async (deck: DeckDefinition, size: SlideSize, settings: RenderSettings): Promise<RenderResult> => {
  const resolved = resolveDeck(deck(createContext(size)));
  const { positioned, diagnostics } = fitDeck(resolved, size, settings.env);
  const buffer = await emitPptx(positioned, {
    debug: settings.debug,
    baseDir: settings.baseDir,
    lang: settings.lang,
    lineBreaks: settings.lineBreaks,
  });
  const result: RenderResult = { size: size.name, buffer, diagnostics, ...(settings.includePositioned ? { positioned } : {}) };
  if (settings.preview === false) return result;
  return { ...result, preview: renderPreview(positioned, diagnostics, settings, settings.preview) };
};

/** API programática: nunca grava arquivo nem imprime. */
export const render = async (deck: DeckDefinition, options: RenderOptions = {}): Promise<RenderResult[]> => {
  const settings = settingsOf(options);
  const sizes = (options.sizes ?? ['16x9']).map(resolveSize);
  return Promise.all(sizes.map((size) => renderSize(deck, size, settings)));
};
