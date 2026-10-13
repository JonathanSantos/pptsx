/**
 * Fábricas de nós literais (resolvidos e posicionados) para testar layout e emit
 * sem depender do resolve/layout reais.
 */
import type {
  BoxProps,
  Dimensions,
  ImageProps,
  LayoutEnv,
  PositionedBox,
  PositionedDeck,
  PositionedImage,
  PositionedNode,
  PositionedShape,
  PositionedSlide,
  PositionedText,
  Rect,
  ResolvedBox,
  ResolvedDeck,
  ResolvedImage,
  ResolvedNode,
  ResolvedShape,
  ResolvedSlide,
  ResolvedText,
  ShapeProps,
  SlideProps,
  SlideSize,
  TextLayout,
  TextMeasureInput,
  TextProps,
} from '../../src/core/types.ts';

export const SIZE_16X9: SlideSize = { name: '16x9', width: 720, height: 405 };
export const SIZE_4X3: SlideSize = { name: '4x3', width: 720, height: 540 };

// ───────────── resolvidos ─────────────

export const rSlide = (
  children: readonly ResolvedNode[] = [],
  props: Omit<SlideProps, 'children'> = {},
  path = 'Slide',
): ResolvedSlide => ({ kind: 'slide', path, props, children });

export const rBox = (
  props: Omit<BoxProps, 'children'> = {},
  children: readonly ResolvedNode[] = [],
  path = 'Box',
): ResolvedBox => ({ kind: 'box', path, props, children });

export const rText = (
  content: string,
  props: Omit<TextProps, 'children'> = {},
  path = 'Text',
): ResolvedText => ({ kind: 'text', path, props, content });

export const rImage = (props: ImageProps, path = 'Image'): ResolvedImage => ({ kind: 'image', path, props });

export const rShape = (props: ShapeProps, path = 'Shape'): ResolvedShape => ({ kind: 'shape', path, props });

export const rDeck = (...slides: ResolvedSlide[]): ResolvedDeck => ({ slides });

// ───────────── LayoutEnv falso ─────────────

export const FAKE_LINE_HEIGHT = 20;
export const FAKE_IMAGE: Dimensions = { width: 400, height: 200 };

/** Layout falso: cada '\n' separa um parágrafo de uma linha só. */
export const fakeTextLayout = (content: string, fontSize = 18): TextLayout =>
  fakeParagraphLayout(content.split('\n').map((line) => [line]), fontSize);

/** Layout falso a partir de parágrafos explícitos (várias linhas por parágrafo). lines = paragraphs.flat(). */
export const fakeParagraphLayout = (
  paragraphs: readonly (readonly string[])[],
  fontSize = 18,
  truncated = false,
): TextLayout => {
  const lines = paragraphs.flat();
  return {
    lines,
    paragraphs,
    fontSize,
    lineHeight: FAKE_LINE_HEIGHT,
    ascent: 16,
    width: 100,
    height: lines.length * FAKE_LINE_HEIGHT,
    widestSegment: 0,
    truncated,
    fontMissing: false,
    wordBroken: false,
  };
};

/** Medidor determinístico: uma linha por '\n', 20 pt por linha. Registra as chamadas. */
export const createFakeEnv = (image: Dimensions = FAKE_IMAGE) => {
  const measureCalls: TextMeasureInput[] = [];
  const imageCalls: string[] = [];
  const env: LayoutEnv = {
    measureText: (input) => {
      measureCalls.push(input);
      return fakeTextLayout(input.content, input.style.size);
    },
    imageSize: (src) => {
      imageCalls.push(src);
      return image;
    },
  };
  return { env, measureCalls, imageCalls };
};

// ───────────── posicionados ─────────────

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const pSlide = (
  children: readonly PositionedNode[] = [],
  props: Omit<SlideProps, 'children'> = {},
  size: SlideSize = SIZE_16X9,
): PositionedSlide => ({
  kind: 'slide',
  path: 'Slide',
  props,
  frame: rect(0, 0, size.width, size.height),
  children,
});

export const pBox = (
  frame: Rect,
  props: Omit<BoxProps, 'children'> = {},
  children: readonly PositionedNode[] = [],
): PositionedBox => ({ kind: 'box', path: 'Slide > Box', props, frame, children });

export const pText = (
  frame: Rect,
  content: string,
  props: Omit<TextProps, 'children'> = {},
  text: TextLayout = fakeTextLayout(content, props.size ?? 18),
): PositionedText => ({ kind: 'text', path: 'Slide > Text', props, content, frame, text });

export const pImage = (frame: Rect, props: ImageProps, intrinsic: Dimensions = FAKE_IMAGE): PositionedImage => ({
  kind: 'image',
  path: 'Slide > Image',
  props,
  frame,
  intrinsic,
});

export const pShape = (frame: Rect, props: ShapeProps): PositionedShape => ({
  kind: 'shape',
  path: 'Slide > Shape',
  props,
  frame,
});

export const pDeck = (slides: readonly PositionedSlide[], size: SlideSize = SIZE_16X9): PositionedDeck => ({
  size,
  slides,
});
