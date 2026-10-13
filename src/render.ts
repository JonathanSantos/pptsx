import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';
import { resolveAssetPath } from './core/assets.ts';
import type {
  DeckDefinition,
  Dimensions,
  LayoutEnv,
  RenderOptions,
  RenderResult,
  SlideSize,
  TextMeasurer,
} from './core/types.ts';
import { emitPptx } from './emit/index.ts';
import { layoutDeck } from './layout/index.ts';
import { resolveDeck } from './resolve/index.ts';
import { createContext, resolveSize } from './sizes.ts';

// Provisório do M1: estimativa grosseira até o medidor real chegar (M2/M3).
const provisionalMeasurer: TextMeasurer = ({ content, style, maxWidth }) => {
  const charWidth = style.size * 0.5;
  const lineHeight = style.size * 1.2 * style.lineHeight;
  const charsPerLine = Number.isFinite(maxWidth) ? Math.max(1, Math.floor(maxWidth / charWidth)) : Infinity;
  const lines = content.split('\n').flatMap((p) => chunk(p, charsPerLine));
  const width = Math.max(0, ...lines.map((line) => line.length * charWidth));
  return {
    lines,
    fontSize: style.size,
    lineHeight,
    ascent: style.size * 0.9 * style.lineHeight,
    width,
    height: lines.length * lineHeight,
    truncated: false,
    fontMissing: false,
  };
};

const chunk = (text: string, size: number): string[] => {
  if (text.length <= size) return [text];
  return [text.slice(0, size), ...chunk(text.slice(size), size)];
};

const readImageSize =
  (baseDir: string) =>
  (src: string): Dimensions => {
    const { width, height } = imageSize(readFileSync(resolveAssetPath(baseDir, src)));
    return { width: width ?? 0, height: height ?? 0 };
  };

const createLayoutEnv = (baseDir: string): LayoutEnv => ({
  measureText: provisionalMeasurer,
  imageSize: readImageSize(baseDir),
});

const renderSize = async (
  deck: DeckDefinition,
  size: SlideSize,
  env: LayoutEnv,
  options: RenderOptions,
  baseDir: string,
): Promise<RenderResult> => {
  const resolved = resolveDeck(deck(createContext(size)));
  const positioned = layoutDeck(resolved, size, env);
  const buffer = await emitPptx(positioned, { debug: options.debug ?? false, baseDir });
  return { size: size.name, buffer, diagnostics: [] };
};

/** API programática: nunca grava arquivo nem imprime. */
export const render = async (deck: DeckDefinition, options: RenderOptions = {}): Promise<RenderResult[]> => {
  const baseDir = options.baseDir ?? process.cwd();
  const env = createLayoutEnv(baseDir);
  const sizes = (options.sizes ?? ['16x9']).map(resolveSize);
  return Promise.all(sizes.map((size) => renderSize(deck, size, env, options, baseDir)));
};
