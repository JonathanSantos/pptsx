import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';
import { resolveAssetPath } from './core/assets.ts';
import { DEFAULTS } from './core/defaults.ts';
import type {
  DeckDefinition,
  Dimensions,
  FontFace,
  LayoutEnv,
  PositionedDeck,
  PreviewOptions,
  RenderOptions,
  RenderResult,
  SlideSize,
} from './core/types.ts';
import { emitPptx } from './emit/index.ts';
import { DEFAULT_FONTS, fontFamilyMapOf } from './fonts.ts';
import { layoutDeck } from './layout/index.ts';
import { buildOverview, slideToSvg, svgToPng } from './preview/index.ts';
import { resolveDeck } from './resolve/index.ts';
import { createContext, resolveSize } from './sizes.ts';
import { createEstimateMeasurer } from './text/index.ts';

/** Tudo que é derivado das opções uma única vez e vale para todos os tamanhos. */
interface RenderSettings {
  readonly baseDir: string;
  readonly debug: boolean;
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
  return {
    baseDir,
    debug: options.debug ?? false,
    fonts: options.fonts ?? DEFAULT_FONTS,
    preview: options.preview ?? { mode: 'native', width: DEFAULTS.preview.width },
    env: { measureText: createEstimateMeasurer(), imageSize: readImageSize(baseDir) },
  };
};

const renderPreview = (deck: PositionedDeck, settings: RenderSettings, preview: PreviewOptions) => {
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
    slides.map((png, index) => ({ png, number: index + 1 })),
    { fontFiles },
  );
  return { slides, overview };
};

const renderSize = async (deck: DeckDefinition, size: SlideSize, settings: RenderSettings): Promise<RenderResult> => {
  const resolved = resolveDeck(deck(createContext(size)));
  const positioned = layoutDeck(resolved, size, settings.env);
  const buffer = await emitPptx(positioned, { debug: settings.debug, baseDir: settings.baseDir });
  const result = { size: size.name, buffer, diagnostics: [] };
  if (settings.preview === false) return result;
  return { ...result, preview: renderPreview(positioned, settings, settings.preview) };
};

/** API programática: nunca grava arquivo nem imprime. */
export const render = async (deck: DeckDefinition, options: RenderOptions = {}): Promise<RenderResult[]> => {
  const settings = settingsOf(options);
  const sizes = (options.sizes ?? ['16x9']).map(resolveSize);
  return Promise.all(sizes.map((size) => renderSize(deck, size, settings)));
};
