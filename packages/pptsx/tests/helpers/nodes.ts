/**
 * Fábricas de nós literais (resolvidos e posicionados) para testar layout e emit
 * sem depender do resolve/layout reais.
 */
import type {
  BoxProps,
  ChartProps,
  PositionedChart,
  PositionedTable,
  Pt,
  ResolvedChart,
  ResolvedTable,
  TableProps,
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
  LineRun,
  TextLayout,
  TextMeasureInput,
  TextProps,
  TextRun,
} from '../../src/core/types.ts';
import { DEFAULTS, tableHeaderOf, tableStyleOf } from '../../src/core/defaults.ts';
import { boxOf, legacyCssOf, nodePropsOf } from './css.ts';
import { tableGridOf } from '../../src/resolve/index.ts';

/** Props de slide na língua interna dos testes: `background` cor ou `{ image }` (o autor usa CSS desde a 1.0). */
export type TestSlideProps = Omit<SlideProps, 'children'> & { readonly background?: string | { readonly image: string } };

export const SIZE_16X9: SlideSize = { name: '16x9', width: 720, height: 405 };
export const SIZE_4X3: SlideSize = { name: '4x3', width: 720, height: 540 };

// ───────────── resolvidos ─────────────

export const rSlide = (
  children: readonly ResolvedNode[] = [],
  props: TestSlideProps = {},
  path = 'Slide',
): ResolvedSlide => ({ kind: 'slide', path, sourceSlide: 1, css: legacyCssOf('slide', props), props: nodePropsOf('slide', props), children });

export const rBox = (
  props: Omit<BoxProps, 'children'> = {},
  children: readonly ResolvedNode[] = [],
  path = 'Box',
): ResolvedBox => ({ kind: 'box', path, css: legacyCssOf('box', props), props: nodePropsOf('box', props), children });

/** M8: runs como o resolve gera sem Span — um run com o estilo do Text; conteúdo vazio → nenhum. */
export const runsOf = (content: string, props: Omit<TextProps, 'children'> = {}): readonly TextRun[] =>
  content === ''
    ? []
    : [
        {
          text: content,
          weight: props.weight ?? DEFAULTS.text.weight,
          italic: props.italic ?? DEFAULTS.text.italic,
          color: props.color ?? DEFAULTS.text.color,
          underline: false,
          lineThrough: false,
        },
      ];

/** M8: lineRuns de um layout com um run só (índice 0); linha vazia → []. */
export const singleRunLines = (lines: readonly string[]): readonly (readonly LineRun[])[] =>
  lines.map((line) => (line === '' ? [] : [{ text: line, run: 0 }]));

export const rText = (
  content: string,
  props: Omit<TextProps, 'children'> = {},
  path = 'Text',
  runs: readonly TextRun[] = runsOf(content, props),
): ResolvedText => ({ kind: 'text', path, css: legacyCssOf('text', props), props: nodePropsOf('text', props), content, runs });

export const rImage = (props: ImageProps, path = 'Image'): ResolvedImage => ({ kind: 'image', path, css: legacyCssOf('image', props), props: nodePropsOf('image', props) });

export const rShape = (props: ShapeProps, path = 'Shape'): ResolvedShape => ({ kind: 'shape', path, css: legacyCssOf('shape', props), props: nodePropsOf('shape', props) });

export const rDeck = (...slides: ResolvedSlide[]): ResolvedDeck => ({ slides });

/** M10: Chart resolvido (dados assumidos válidos). */
export const rChart = (props: ChartProps, path = 'Chart'): ResolvedChart => ({ kind: 'chart', path, css: legacyCssOf('chart', props), props: nodePropsOf('chart', props) });

/** M10: Table resolvida com `rows` normalizado para string, como o resolve entrega. */
/** M14: grade como o resolve monta (sem ícones: o env não lê arquivo). */
const gridOf = (props: TableProps) => {
  const { grid, headerCount } = tableGridOf(props, 'Table', { readAsset: () => '' });
  return { grid, headerCount };
};

export const rTable = (props: TableProps, path = 'Table'): ResolvedTable => ({
  kind: 'table',
  path,
  css: legacyCssOf('table', props),
  props: nodePropsOf('table', props),
  rows: props.rows.map((row) => row.map(String)),
  ...gridOf(props),
});

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
    lineRuns: singleRunLines(lines),
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

/** M11: `css` derivado das props da engine e o `box` que o layout daria a ele. */
const placed = (kind: Parameters<typeof legacyCssOf>[0], props: object) => {
  const css = legacyCssOf(kind, props);
  return { css, box: boxOf(css), props: nodePropsOf(kind, props) };
};

export const pSlide = (
  children: readonly PositionedNode[] = [],
  props: TestSlideProps = {},
  size: SlideSize = SIZE_16X9,
): PositionedSlide => ({
  kind: 'slide',
  path: 'Slide',
  sourceSlide: 1,
  ...placed('slide', props),
  frame: rect(0, 0, size.width, size.height),
  children,
});

export const pBox = (
  frame: Rect,
  props: Omit<BoxProps, 'children'> = {},
  children: readonly PositionedNode[] = [],
): PositionedBox => ({ kind: 'box', path: 'Slide > Box', ...placed('box', props), frame, children });

export const pText = (
  frame: Rect,
  content: string,
  props: Omit<TextProps, 'children'> = {},
  text: TextLayout = fakeTextLayout(content, props.size ?? 18),
  runs: readonly TextRun[] = runsOf(content, props),
): PositionedText => ({ kind: 'text', path: 'Slide > Text', ...placed('text', props), content, runs, frame, text });

export const pImage = (frame: Rect, props: ImageProps, intrinsic: Dimensions = FAKE_IMAGE): PositionedImage => ({
  kind: 'image',
  path: 'Slide > Image',
  ...placed('image', props),
  frame,
  intrinsic,
});

export const pShape = (frame: Rect, props: ShapeProps): PositionedShape => ({
  kind: 'shape',
  path: 'Slide > Shape',
  ...placed('shape', props),
  frame,
});

export const pDeck = (slides: readonly PositionedSlide[], size: SlideSize = SIZE_16X9): PositionedDeck => ({
  size,
  slides,
});

// ───────────── M10: Chart e Table posicionados ─────────────

export const pChart = (frame: Rect, props: ChartProps, path = 'Slide > Chart'): PositionedChart => ({
  kind: 'chart',
  path,
  ...placed('chart', props),
  frame,
});

export interface PTableOptions {
  readonly path?: string;
  /** Padrão: frame.width dividido igualmente. */
  readonly columnWidths?: readonly Pt[];
  /** Padrão: tableStyleOf(props).size. */
  readonly fontSize?: Pt;
  /** Padrão: fakeTextLayout de cada célula (cabeçalho na linha 0 quando há). */
  readonly cells?: readonly (readonly TextLayout[])[];
}

/** Linhas de texto da tabela como o layout as mede: cabeçalho (quando há) + linhas de dados. */
export const tableTextRows = (props: TableProps): readonly (readonly string[])[] => {
  const data = props.rows.map((row) => row.map(String));
  return tableHeaderOf(props) === undefined ? data : [props.columns.map((c) => c.header), ...data];
};

/**
 * Table posicionada com células do medidor falso (uma linha por '\n', 20 pt por linha):
 * rowHeights = célula mais alta + 2 × cellPadding; height = Σ rowHeights.
 */
export const pTable = (frame: Rect, props: TableProps, options: PTableOptions = {}): PositionedTable => {
  const fontSize = options.fontSize ?? tableStyleOf(props).size;
  const padding = props.cellPadding ?? DEFAULTS.table.cellPadding;
  const n = props.columns.length;
  const columnWidths = options.columnWidths ?? props.columns.map(() => frame.width / n);
  const cells = options.cells ?? tableTextRows(props).map((row) => row.map((c) => fakeTextLayout(c, fontSize)));
  const rowHeights = cells.map((row) => Math.max(0, ...row.map((c) => c.height)) + 2 * padding);
  return {
    kind: 'table',
    path: options.path ?? 'Slide > Table',
    ...placed('table', props),
    rows: props.rows.map((row) => row.map(String)),
    ...gridOf(props),
    frame,
    fontSize,
    columnWidths,
    rowHeights,
    cells,
    height: rowHeights.reduce((a, b) => a + b, 0),
  };
};
