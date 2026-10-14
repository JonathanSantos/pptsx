import type * as Pptx from './pptx.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type { LineBreaks, PositionedNode, Rect } from '../core/types.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { chartOf } from './chart.ts';
import { boxShapeOf, debugOutlineOf, imageOf, shapeOf, textOf, type ShapeSpec } from './options.ts';
import { tableOf } from './table.ts';

export interface EmitContext {
  readonly baseDir: string;
  readonly lineSpacing?: LineSpacingStrategy;
  readonly lang?: string;
  readonly lineBreaks?: LineBreaks;
}

/** pptxgenjs muta os objetos de opções; cada chamada recebe uma cópia rasa. */
const addShape = (slide: Pptx.Slide, spec: ShapeSpec): void => {
  slide.addShape(spec.shape, { ...spec.options });
};

// O nó vem primeiro para o `dispatch` inferir os argumentos extras.
const emitters: DispatchTable<PositionedNode, void, [slide: Pptx.Slide, ctx: EmitContext]> = {
  box: (node, slide, ctx) => {
    const spec = boxShapeOf(node);
    if (spec) addShape(slide, spec);
    node.children.forEach((child) => emitNode(slide, child, ctx));
  },
  text: (node, slide, ctx) => {
    const { runs, options } = textOf(node, ctx.lineSpacing, ctx.lang, ctx.lineBreaks);
    slide.addText(runs, options);
  },
  image: (node, slide, ctx) => {
    slide.addImage(imageOf(node, ctx.baseDir));
  },
  shape: (node, slide) => {
    addShape(slide, shapeOf(node));
  },
  // addChart/addTable mutam dados e opções em profundidade (labels, bordas, unidades): cópia funda.
  chart: (node, slide) => {
    const { type, data, options } = structuredClone(chartOf(node));
    slide.addChart(type, data, options);
  },
  table: (node, slide, ctx) => {
    const { rows, options } = structuredClone(tableOf(node, ctx));
    slide.addTable(rows, options);
  },
};

/** Ordem de desenho = ordem da árvore: pai antes dos filhos. */
export const emitNode = (slide: Pptx.Slide, node: PositionedNode, ctx: EmitContext): void =>
  dispatch(emitters, node, slide, ctx);

const hasDebugFrame = (node: PositionedNode): boolean => node.kind !== 'shape';

const childrenOf = (node: PositionedNode): readonly PositionedNode[] => (node.kind === 'box' ? node.children : []);

/** Frames de Box/Text/Image/Chart/Table em ordem de árvore, para o contorno de debug. */
export const debugFramesOf = (nodes: readonly PositionedNode[]): readonly Rect[] =>
  nodes.flatMap((node) => [...(hasDebugFrame(node) ? [node.frame] : []), ...debugFramesOf(childrenOf(node))]);

export const emitDebugOutlines = (slide: Pptx.Slide, nodes: readonly PositionedNode[]): void => {
  debugFramesOf(nodes).forEach((frame) => addShape(slide, debugOutlineOf(frame)));
};
