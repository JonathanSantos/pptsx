import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';
import { resolveAssetPath } from '../../src/core/assets.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { DeckDefinition, Dimensions, LineBreaks, PreviewOptions, RenderOptions, SlideSize } from '../../src/core/types.ts';
import { DEFAULT_FONTS, fontFamilyMapOf, resolveFontFaces, type FileFontFace } from '../../src/fonts/index.ts';
import { buildOverview, svgToPng } from '../../src/preview/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { createFontRegistry } from '../../src/text/index.ts';
import { emitPptx } from './emit/index.ts';
import { cssNotEmittedOf } from './fit/css.ts';
import { fitDeck } from './fit/index.ts';
import { slideToSvg } from './preview/slide.ts';
import { resolveDeck } from './resolve/index.ts';
import { createCssMeasurer } from './text/measure.ts';
import type { Diagnostic, LayoutEnv, PositionedDeck, RenderResult } from './types.ts';

/**
 * render() da PoC: mesmo fluxo de src/render.ts (resolve → fit → emit → preview) com as
 * etapas da PoC. Sem embed de fontes (fora do escopo da PoC). Nunca grava arquivo.
 */

interface Settings {
  readonly baseDir: string;
  readonly debug: boolean;
  readonly lang: string;
  readonly lineBreaks: LineBreaks;
  readonly includePositioned: boolean;
  readonly fonts: readonly FileFontFace[];
  readonly fontsMissing: readonly string[];
  readonly preview: PreviewOptions | false;
  readonly env: LayoutEnv;
}

const readImageSize =
  (baseDir: string) =>
  (src: string): Dimensions => {
    const { width, height } = imageSize(readFileSync(resolveAssetPath(baseDir, src)));
    return { width: width ?? 0, height: height ?? 0 };
  };

/** Ambiente de layout (medidor fontkit + letterSpacing, tamanho de imagem): IO de borda. */
export const createEnv = (options: Pick<RenderOptions, 'fonts' | 'textSafety' | 'baseDir'> = {}): LayoutEnv => {
  const { faces } = resolveFontFaces(options.fonts ?? DEFAULT_FONTS);
  return {
    measureText: createCssMeasurer(createFontRegistry(faces), options.textSafety ?? DEFAULTS.textSafety),
    imageSize: readImageSize(options.baseDir ?? process.cwd()),
  };
};

const settingsOf = (options: RenderOptions): Settings => {
  const baseDir = options.baseDir ?? process.cwd();
  const { faces: fonts, missing: fontsMissing } = resolveFontFaces(options.fonts ?? DEFAULT_FONTS);
  return {
    baseDir,
    debug: options.debug ?? false,
    lang: options.lang ?? DEFAULTS.lang,
    lineBreaks: options.lineBreaks ?? DEFAULTS.lineBreaks,
    includePositioned: options.includePositioned ?? false,
    fonts,
    fontsMissing,
    preview: options.preview ?? { mode: 'native', width: DEFAULTS.preview.width },
    env: {
      measureText: createCssMeasurer(createFontRegistry(fonts), options.textSafety ?? DEFAULTS.textSafety),
      imageSize: readImageSize(baseDir),
    },
  };
};

const badgeOf = (diagnostics: readonly Diagnostic[], slide: number): 'error' | 'warning' | undefined => {
  const severities = diagnostics.filter((d) => d.slide === slide).map((d) => d.severity);
  if (severities.includes('error')) return 'error';
  if (severities.includes('warning')) return 'warning';
  return undefined;
};

const renderPreview = (deck: PositionedDeck, diagnostics: readonly Diagnostic[], settings: Settings, preview: PreviewOptions) => {
  const widthPx = preview.width ?? DEFAULTS.preview.width;
  const fontFiles = settings.fonts.map((face) => face.file);
  const svgOptions = { widthPx, debug: settings.debug, baseDir: settings.baseDir, fontFamilyMap: fontFamilyMapOf(settings.fonts) };
  const slides = deck.slides.map((slide) => svgToPng(slideToSvg(slide, deck.size, svgOptions), { widthPx, fontFiles }));
  const overview = buildOverview(
    slides.map((png, index) => ({ png, number: index + 1, badge: badgeOf(diagnostics, index + 1) })),
    { fontFiles },
  );
  return { slides, overview };
};

/** Layout + fit + diagnósticos de um tamanho, sem emitir (testes e comparação). */
export const fitSize = (deck: DeckDefinition, size: SlideSize, env: LayoutEnv) => {
  const ctx = createContext(size);
  const fitted = fitDeck({ deck: resolveDeck(deck(ctx), ctx), size, env });
  const diagnostics: readonly Diagnostic[] = [...fitted.diagnostics, ...cssNotEmittedOf(fitted.positioned)];
  return { positioned: fitted.positioned, diagnostics };
};

const renderSize = async (deck: DeckDefinition, size: SlideSize, settings: Settings): Promise<RenderResult> => {
  const { positioned, diagnostics } = fitSize(deck, size, settings.env);
  const buffer = await emitPptx(positioned, {
    debug: settings.debug,
    baseDir: settings.baseDir,
    lang: settings.lang,
    lineBreaks: settings.lineBreaks,
  });
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

export const render = async (deck: DeckDefinition, options: RenderOptions = {}): Promise<RenderResult[]> => {
  const settings = settingsOf(options);
  const sizes = (options.sizes ?? ['16x9']).map(resolveSize);
  return Promise.all(sizes.map((size) => renderSize(deck, size, settings)));
};
