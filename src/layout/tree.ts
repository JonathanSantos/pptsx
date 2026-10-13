import Yoga, { type Config, MeasureMode, type MeasureFunction, type Node as YogaNode } from 'yoga-layout';
import { containerOf, textStyleOf } from '../core/defaults.ts';
import type {
  Dimensions,
  FlexDirection,
  LayoutEnv,
  ResolvedBox,
  ResolvedImage,
  ResolvedNode,
  ResolvedShape,
  ResolvedText,
} from '../core/types.ts';
import { applyStyle } from './apply.ts';
import { toImageStyle, toItemStyle, toYogaStyle } from './style.ts';

/** Nó resolvido pareado com seu nó Yoga (e o que foi lido do env na construção). */
export interface BuiltNode {
  readonly source: ResolvedNode;
  readonly yoga: YogaNode;
  readonly children: readonly BuiltNode[];
  readonly intrinsic?: Dimensions;
}

export interface BuildContext {
  readonly config: Config;
  readonly env: LayoutEnv;
  /** Direção do contêiner pai: define o eixo principal do item. */
  readonly parentDirection: FlexDirection;
}

type Builder<N extends ResolvedNode> = (source: N, yoga: YogaNode, ctx: BuildContext) => BuiltNode;

const textMeasureFunc =
  (source: ResolvedText, env: LayoutEnv): MeasureFunction =>
  (width, widthMode) => {
    const maxWidth = widthMode === MeasureMode.Undefined ? Number.POSITIVE_INFINITY : width;
    const text = env.measureText({
      content: source.content,
      style: textStyleOf(source.props),
      maxWidth,
      maxLines: source.props.maxLines,
    });
    if (widthMode === MeasureMode.Exactly) return { width, height: text.height };
    if (widthMode === MeasureMode.AtMost) return { width: Math.min(text.width, width), height: text.height };
    return { width: text.width, height: text.height };
  };

const buildBox: Builder<ResolvedBox> = (source, yoga, ctx) => {
  applyStyle(yoga, toYogaStyle(source.props, ctx.parentDirection));
  const childCtx = { ...ctx, parentDirection: containerOf(source.props).direction };
  return { source, yoga, children: buildChildren(source.children, yoga, childCtx) };
};

const buildText: Builder<ResolvedText> = (source, yoga, { env, parentDirection }) => {
  applyStyle(yoga, toItemStyle(source.props, parentDirection));
  yoga.setMeasureFunc(textMeasureFunc(source, env));
  return { source, yoga, children: [] };
};

const buildImage: Builder<ResolvedImage> = (source, yoga, { env, parentDirection }) => {
  const intrinsic = env.imageSize(source.props.src);
  applyStyle(yoga, toImageStyle(source.props, intrinsic, parentDirection));
  return { source, yoga, children: [], intrinsic };
};

const buildShape: Builder<ResolvedShape> = (source, yoga, { parentDirection }) => {
  applyStyle(yoga, toItemStyle(source.props, parentDirection));
  return { source, yoga, children: [] };
};

const BUILDERS: { readonly [K in ResolvedNode['kind']]: Builder<Extract<ResolvedNode, { kind: K }>> } = {
  box: buildBox,
  text: buildText,
  image: buildImage,
  shape: buildShape,
};

const buildNode = (source: ResolvedNode, parent: YogaNode, ctx: BuildContext): BuiltNode => {
  const yoga = Yoga.Node.create(ctx.config);
  // Anexar antes de configurar: se algo lançar no meio, o freeRecursive da raiz ainda alcança este nó.
  parent.insertChild(yoga, parent.getChildCount());
  // TS não correlaciona source.kind com a entrada da tabela; o tipo da tabela garante a coerência.
  const builder = BUILDERS[source.kind] as Builder<ResolvedNode>;
  return builder(source, yoga, ctx);
};

/** Cria (e anexa ao `parent`) a subárvore Yoga dos filhos. */
export const buildChildren = (
  children: readonly ResolvedNode[],
  parent: YogaNode,
  ctx: BuildContext,
): readonly BuiltNode[] => children.map((child) => buildNode(child, parent, ctx));
