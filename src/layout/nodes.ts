import { PT_PER_INCH, textStyleOf } from '../core/defaults.ts';
import type {
  Dimensions,
  LayoutEnv,
  PositionedBox,
  PositionedImage,
  PositionedNode,
  PositionedShape,
  PositionedText,
  ResolvedBox,
  ResolvedImage,
  ResolvedNode,
  ResolvedShape,
  ResolvedText,
} from '../core/types.ts';
import { type ExplicitSize, type ParentArea, type Placement, parentAreaOf, placementOf } from './placement.ts';

// Imagens trazem tamanho em px CSS (96 por polegada); o natural em pt é px × 0.75.
const CSS_PX_PER_INCH = 96;
const PT_PER_PX = PT_PER_INCH / CSS_PX_PER_INCH;

type NodeLayouter<N extends ResolvedNode, P extends PositionedNode> = (
  node: N,
  parent: ParentArea,
  env: LayoutEnv,
) => P;

const fillAvailable = ({ explicit, available }: Placement): Dimensions => ({
  width: explicit.width ?? available.width,
  height: explicit.height ?? available.height,
});

const layoutBox: NodeLayouter<ResolvedBox, PositionedBox> = (node, parent, env) => {
  const placement = placementOf(node.props, parent);
  const { width, height } = fillAvailable(placement);
  const frame = placement.place(width, height);
  return { ...node, frame, children: layoutChildren(node.children, parentAreaOf(frame, node.props.padding), env) };
};

const layoutShape: NodeLayouter<ResolvedShape, PositionedShape> = (node, parent) => {
  const placement = placementOf(node.props, parent);
  const { width, height } = fillAvailable(placement);
  return { ...node, frame: placement.place(width, height) };
};

const layoutText: NodeLayouter<ResolvedText, PositionedText> = (node, parent, env) => {
  const placement = placementOf(node.props, parent);
  const width = placement.explicit.width ?? placement.available.width;
  const text = env.measureText({
    content: node.content,
    style: textStyleOf(node.props),
    maxWidth: width,
    maxLines: node.props.maxLines,
  });
  const height = placement.explicit.height ?? text.height;
  return { ...node, frame: placement.place(width, height), text };
};

const imageSizeOf = ({ width, height }: ExplicitSize, intrinsic: Dimensions): Dimensions => {
  if (width !== undefined && height !== undefined) return { width, height };
  if (width !== undefined) return { width, height: (width * intrinsic.height) / intrinsic.width };
  if (height !== undefined) return { width: (height * intrinsic.width) / intrinsic.height, height };
  return { width: intrinsic.width * PT_PER_PX, height: intrinsic.height * PT_PER_PX };
};

const layoutImage: NodeLayouter<ResolvedImage, PositionedImage> = (node, parent, env) => {
  const placement = placementOf(node.props, parent);
  const intrinsic = env.imageSize(node.props.src);
  const { width, height } = imageSizeOf(placement.explicit, intrinsic);
  return { ...node, frame: placement.place(width, height), intrinsic };
};

type LayouterTable = {
  readonly [K in ResolvedNode['kind']]: NodeLayouter<
    Extract<ResolvedNode, { kind: K }>,
    Extract<PositionedNode, { kind: K }>
  >;
};

const LAYOUTERS: LayouterTable = {
  box: layoutBox,
  text: layoutText,
  image: layoutImage,
  shape: layoutShape,
};

const layoutNode = (node: ResolvedNode, parent: ParentArea, env: LayoutEnv): PositionedNode => {
  // TS não correlaciona node.kind com a entrada da tabela; o tipo da tabela garante a coerência.
  const layouter = LAYOUTERS[node.kind] as NodeLayouter<ResolvedNode, PositionedNode>;
  return layouter(node, parent, env);
};

export const layoutChildren = (
  children: readonly ResolvedNode[],
  parent: ParentArea,
  env: LayoutEnv,
): readonly PositionedNode[] => children.map((child) => layoutNode(child, parent, env));
