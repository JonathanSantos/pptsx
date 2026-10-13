import type * as Pptx from './pptx.ts';
import type { PositionedNode, Rect } from '../core/types.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { boxShapeOf, debugOutlineOf, imageOf, shapeOf, textOf, type ShapeSpec } from './options.ts';

export interface EmitContext {
  readonly baseDir: string;
  readonly lineSpacing?: LineSpacingStrategy;
  readonly lang?: string;
}

type NodeKind = PositionedNode['kind'];
type NodeOf<K extends NodeKind> = Extract<PositionedNode, { kind: K }>;
type NodeEmitter<K extends NodeKind> = (slide: Pptx.Slide, node: NodeOf<K>, ctx: EmitContext) => void;

/** pptxgenjs muta os objetos de opções; cada chamada recebe uma cópia rasa. */
const addShape = (slide: Pptx.Slide, spec: ShapeSpec): void => {
  slide.addShape(spec.shape, { ...spec.options });
};

const emitters: { readonly [K in NodeKind]: NodeEmitter<K> } = {
  box: (slide, node, ctx) => {
    const spec = boxShapeOf(node);
    if (spec) addShape(slide, spec);
    node.children.forEach((child) => emitNode(slide, child, ctx));
  },
  text: (slide, node, ctx) => {
    const { runs, options } = textOf(node, ctx.lineSpacing, ctx.lang);
    slide.addText(runs, options);
  },
  image: (slide, node, ctx) => {
    slide.addImage(imageOf(node, ctx.baseDir));
  },
  shape: (slide, node) => {
    addShape(slide, shapeOf(node));
  },
};

/** Ordem de desenho = ordem da árvore: pai antes dos filhos. */
export const emitNode = (slide: Pptx.Slide, node: PositionedNode, ctx: EmitContext): void => {
  const emitter = emitters[node.kind] as NodeEmitter<typeof node.kind>;
  emitter(slide, node as never, ctx);
};

const hasDebugFrame = (node: PositionedNode): boolean => node.kind !== 'shape';

const childrenOf = (node: PositionedNode): readonly PositionedNode[] => (node.kind === 'box' ? node.children : []);

/** Frames de Box/Text/Image em ordem de árvore, para o contorno de debug. */
export const debugFramesOf = (nodes: readonly PositionedNode[]): readonly Rect[] =>
  nodes.flatMap((node) => [...(hasDebugFrame(node) ? [node.frame] : []), ...debugFramesOf(childrenOf(node))]);

export const emitDebugOutlines = (slide: Pptx.Slide, nodes: readonly PositionedNode[]): void => {
  debugFramesOf(nodes).forEach((frame) => addShape(slide, debugOutlineOf(frame)));
};
