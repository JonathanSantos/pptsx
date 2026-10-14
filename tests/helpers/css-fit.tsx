/**
 * M11: o fluxo de `render` sem emitir (resolve → fitDeck → css-not-emitted) com o ambiente real
 * (fontkit + letterSpacing, tamanho de imagem lido do disco). Vem de poc/css/tests/helpers.ts;
 * não passa por src/render.ts para os testes do motor não dependerem da integração.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { imageSize } from 'image-size';
import { resolveAssetPath } from '../../src/core/assets.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type {
  DeckDefinition,
  Diagnostic,
  Dimensions,
  LayoutEnv,
  PositionedDeck,
  PositionedNode,
  PositionedSlide,
  Rect,
  SizeSpec,
  SlideElement,
} from '../../src/core/types.ts';
import { emitPptx } from '../../src/emit/index.ts';
import { cssNotEmittedOf, fitDeck } from '../../src/fit/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { Deck } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { createFontkitMeasurer, createFontRegistry } from '../../src/text/index.ts';

export const EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url));

const readImageSize =
  (baseDir: string) =>
  (src: string): Dimensions => {
    const { width, height } = imageSize(readFileSync(resolveAssetPath(baseDir, src)));
    return { width: width ?? 0, height: height ?? 0 };
  };

export const cssEnv = (baseDir: string = EXAMPLES_DIR, textSafety: number = DEFAULTS.textSafety): LayoutEnv => ({
  measureText: createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS), { safety: textSafety }),
  imageSize: readImageSize(baseDir),
  textSafety,
});

export interface CssFitResult {
  readonly positioned: PositionedDeck;
  readonly diagnostics: readonly Diagnostic[];
}

/** Layout + fit + diagnósticos de um tamanho, como `render` faz antes de emitir. */
export const cssFit = (deck: DeckDefinition, size: SizeSpec = '16x9', baseDir: string = EXAMPLES_DIR): CssFitResult => {
  const resolved = resolveSize(size);
  const ctx = createContext(resolved);
  const fitted = fitDeck({ deck: resolveDeck(deck(ctx), ctx), size: resolved, env: cssEnv(baseDir) });
  return { positioned: fitted.positioned, diagnostics: [...fitted.diagnostics, ...cssNotEmittedOf(fitted.positioned)] };
};

export const deckOf =
  (slide: SlideElement): DeckDefinition =>
  () => <Deck>{slide}</Deck>;

export const fitSlideOf = (slide: SlideElement, size: SizeSpec = '16x9'): PositionedSlide => {
  const first = cssFit(deckOf(slide), size).positioned.slides[0];
  if (first === undefined) throw new Error('no slide');
  return first;
};

/** XML de cada slide do .pptx, em ordem. */
export const slideXmlsOf = async (buffer: Buffer): Promise<readonly string[]> => {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return Promise.all(names.map((name) => zip.file(name)!.async('string')));
};

/** cssFit + emitPptx: o XML dos slides de um deck num tamanho. */
export const emittedXmls = async (deck: DeckDefinition, size: SizeSpec = '16x9', baseDir: string = EXAMPLES_DIR): Promise<readonly string[]> =>
  slideXmlsOf(await emitPptx(cssFit(deck, size, baseDir).positioned, { baseDir }));

export const slideXmlOf = async (slide: SlideElement): Promise<string> => (await emittedXmls(deckOf(slide)))[0]!;

export const flatten = (nodes: readonly PositionedNode[]): PositionedNode[] =>
  nodes.flatMap((node) => [node, ...(node.kind === 'box' ? flatten(node.children) : [])]);

export const nodesOf = (slide: PositionedSlide): readonly (PositionedSlide | PositionedNode)[] => [slide, ...flatten(slide.children)];

export const byPath = (slide: PositionedSlide, path: string): PositionedNode => {
  const found = flatten(slide.children).find((node) => node.path === path);
  if (found === undefined) throw new Error(`no ${path}: ${flatten(slide.children).map((n) => n.path).join(', ')}`);
  return found;
};

const KEYS = ['x', 'y', 'width', 'height'] as const;

export const frameDiffs = (path: string, expected: Rect, actual: Rect, tolerance: number = DEFAULTS.css.frameTolerance): string[] =>
  KEYS.filter((key) => Math.abs(expected[key] - actual[key]) > tolerance).map(
    (key) => `${path}.${key}: ${expected[key].toFixed(2)} → ${actual[key].toFixed(2)}`,
  );

/** Nó de referência gravado em fixture (frame [x, y, width, height] com 2 casas; Text com size e linhas). */
export interface BaselineNode {
  readonly path: string;
  readonly kind: string;
  readonly frame: Rect | readonly number[];
  readonly fontSize?: number;
  readonly lines?: number;
}

const rectOf = (frame: Rect | readonly number[]): Rect => {
  if (!Array.isArray(frame)) return frame as Rect;
  const [x = 0, y = 0, width = 0, height = 0] = frame as readonly number[];
  return { x, y, width, height };
};

/** Diferenças de um slide contra a referência (mesmos nós, frames ±1 pt, mesmo size/linhas); [] quando bate. */
export const slideDiffs = (slide: PositionedSlide, want: readonly BaselineNode[]): readonly string[] => {
  const actual = nodesOf(slide);
  const shape = (nodes: readonly { readonly kind: string; readonly path: string }[]) => nodes.map((n) => `${n.kind} ${n.path}`).join('\n');
  if (shape(actual) !== shape(want)) return [`structure:\n${shape(want)}\n×\n${shape(actual)}`];
  return want.flatMap((node, j) => {
    const got = actual[j]!;
    const text =
      got.kind === 'text' && (got.text.fontSize !== node.fontSize || got.text.lines.length !== node.lines)
        ? [`${got.path}: ${node.fontSize}/${node.lines} → ${got.text.fontSize}/${got.text.lines.length}`]
        : [];
    return [...frameDiffs(got.path, rectOf(node.frame), got.frame), ...text];
  });
};
