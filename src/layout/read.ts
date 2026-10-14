import type { Node as YogaNode } from 'yoga-layout';
import { tableStyleOf } from '../core/defaults.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type {
  LayoutEnv,
  PositionedNode,
  Rect,
  ResolvedBox,
  ResolvedChart,
  ResolvedImage,
  ResolvedNode,
  ResolvedShape,
  ResolvedTable,
  ResolvedText,
} from '../core/types.ts';
import { measureInputOf } from './measure.ts';
import { measureTable } from './table.ts';
import type { BuiltNode } from './tree.ts';

interface Origin {
  readonly x: number;
  readonly y: number;
}

/** O Yoga devolve posições relativas ao pai; o contrato quer frames absolutos no slide. */
export const frameOf = (yoga: YogaNode, origin: Origin): Rect => {
  const { left, top, width, height } = yoga.getComputedLayout();
  return { x: origin.x + left, y: origin.y + top, width, height };
};

// O despacho é pelo `source` (que carrega o `kind`); o BuiltNode vem junto pelos filhos e pelo intrinsic.
type Reader<N extends ResolvedNode> = (
  source: N,
  built: BuiltNode,
  frame: Rect,
  env: LayoutEnv,
) => Extract<PositionedNode, { kind: N['kind'] }>;

const readBox: Reader<ResolvedBox> = (source, built, frame, env) => ({
  ...source,
  frame,
  children: readChildren(built.children, frame, env),
});

// As linhas finais são medidas de novo com a largura definitiva do frame.
const readText: Reader<ResolvedText> = (source, _built, frame, env) => ({
  ...source,
  frame,
  text: env.measureText(measureInputOf(source, frame.width)),
});

const readImage: Reader<ResolvedImage> = (source, { intrinsic }, frame, env) => ({
  ...source,
  frame,
  intrinsic: intrinsic ?? env.imageSize(source.props.src),
});

const readShape: Reader<ResolvedShape> = (source, _built, frame) => ({ ...source, frame });

const readChart: Reader<ResolvedChart> = (source, _built, frame) => ({ ...source, frame });

// Como no Text: células quebradas de novo na largura definitiva; height pode passar do frame (estouro).
const readTable: Reader<ResolvedTable> = (source, _built, frame, env) => {
  const { columnWidths, rowHeights, cells, height } = measureTable(source, frame.width, env);
  return { ...source, frame, fontSize: tableStyleOf(source.props).size, columnWidths, rowHeights, cells, height };
};

const READERS: DispatchTable<ResolvedNode, PositionedNode, [built: BuiltNode, frame: Rect, env: LayoutEnv]> = {
  box: readBox,
  text: readText,
  image: readImage,
  shape: readShape,
  chart: readChart,
  table: readTable,
};

const readNode = (built: BuiltNode, origin: Origin, env: LayoutEnv): PositionedNode =>
  dispatch(READERS, built.source, built, frameOf(built.yoga, origin), env);

export const readChildren = (
  children: readonly BuiltNode[],
  origin: Origin,
  env: LayoutEnv,
): readonly PositionedNode[] => children.map((child) => readNode(child, origin, env));
