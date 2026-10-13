import type { Node as YogaNode } from 'yoga-layout';
import { textStyleOf } from '../core/defaults.ts';
import type {
  LayoutEnv,
  PositionedNode,
  Rect,
  ResolvedBox,
  ResolvedImage,
  ResolvedNode,
  ResolvedShape,
  ResolvedText,
} from '../core/types.ts';
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

type Reader<N extends ResolvedNode> = (
  built: BuiltNode & { readonly source: N },
  frame: Rect,
  env: LayoutEnv,
) => Extract<PositionedNode, { kind: N['kind'] }>;

const readBox: Reader<ResolvedBox> = (built, frame, env) => ({
  ...built.source,
  frame,
  children: readChildren(built.children, frame, env),
});

// As linhas finais são medidas de novo com a largura definitiva do frame.
const readText: Reader<ResolvedText> = ({ source }, frame, env) => ({
  ...source,
  frame,
  text: env.measureText({
    content: source.content,
    style: textStyleOf(source.props),
    maxWidth: frame.width,
    maxLines: source.props.maxLines,
  }),
});

const readImage: Reader<ResolvedImage> = ({ source, intrinsic }, frame, env) => ({
  ...source,
  frame,
  intrinsic: intrinsic ?? env.imageSize(source.props.src),
});

const readShape: Reader<ResolvedShape> = ({ source }, frame) => ({ ...source, frame });

const READERS: { readonly [K in ResolvedNode['kind']]: Reader<Extract<ResolvedNode, { kind: K }>> } = {
  box: readBox,
  text: readText,
  image: readImage,
  shape: readShape,
};

const readNode = (built: BuiltNode, origin: Origin, env: LayoutEnv): PositionedNode => {
  // TS não correlaciona source.kind com a entrada da tabela; o tipo da tabela garante a coerência.
  const reader = READERS[built.source.kind] as Reader<ResolvedNode>;
  return reader(built, frameOf(built.yoga, origin), env);
};

export const readChildren = (
  children: readonly BuiltNode[],
  origin: Origin,
  env: LayoutEnv,
): readonly PositionedNode[] => children.map((child) => readNode(child, origin, env));
