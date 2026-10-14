import Yoga, {
  Align as YogaAlign,
  type Config,
  FlexDirection as YogaFlexDirection,
  Justify as YogaJustify,
  MeasureMode,
  type MeasureFunction,
  type Node as YogaNode,
} from 'yoga-layout';
import { DEFAULTS, containerOf } from '../core/defaults.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type {
  Align,
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
import { measureInputOf } from './measure.ts';
import {
  readsBaseline,
  toImageStyle,
  toItemStyle,
  toTextStyle,
  toYogaStyle,
  withLineMinWidth,
  type YogaStyle,
} from './style.ts';

/** Nó resolvido pareado com seu nó Yoga (e o que foi lido do env na construção). */
export interface BuiltNode {
  readonly source: ResolvedNode;
  readonly yoga: YogaNode;
  readonly children: readonly BuiltNode[];
  readonly intrinsic?: Dimensions;
}

/** O que o item precisa saber do contêiner pai. */
export interface ParentContext {
  /** Define o eixo principal do item. */
  readonly direction: FlexDirection;
  /** align-items do pai (alignSelf ausente herda). */
  readonly align: Align;
  /** A baseline do pai é lida por um ancestral (então a dos filhos também importa). */
  readonly baseline: boolean;
}

export interface BuildContext {
  readonly config: Config;
  readonly env: LayoutEnv;
  readonly parent: ParentContext;
}

type Builder<N extends ResolvedNode> = (source: N, yoga: YogaNode, ctx: BuildContext) => BuiltNode;

const textMeasureFunc =
  (source: ResolvedText, env: LayoutEnv): MeasureFunction =>
  (width, widthMode) => {
    const maxWidth = widthMode === MeasureMode.Undefined ? Number.POSITIVE_INFINITY : width;
    const text = env.measureText(measureInputOf(source, maxWidth));
    if (widthMode === MeasureMode.Exactly) return { width, height: text.height };
    if (widthMode === MeasureMode.AtMost) return { width: Math.min(text.width, width), height: text.height };
    return { width: text.width, height: text.height };
  };

const unbounded = (source: ResolvedText, env: LayoutEnv) =>
  env.measureText(measureInputOf(source, Number.POSITIVE_INFINITY));

const textItemStyleOf = (source: ResolvedText, { env, parent }: BuildContext): YogaStyle => {
  const style = toTextStyle(source.props, parent.direction);
  if (source.props.nowrap !== true || parent.direction !== 'row') return style;
  return withLineMinWidth(style, unbounded(source, env).width);
};

const createChild = (parent: YogaNode, config: Config): YogaNode => {
  const child = Yoga.Node.create(config);
  // Anexar antes de configurar: se algo lançar no meio, o freeRecursive da raiz ainda alcança este nó.
  parent.insertChild(child, parent.getChildCount());
  return child;
};

/** O invólucro só empilha o marcador e a folha; o tamanho continua sendo o do texto. */
const BASELINE_WRAPPER: YogaStyle = {
  flexDirection: YogaFlexDirection.Column,
  alignItems: YogaAlign.Stretch,
  justifyContent: YogaJustify.FlexStart,
  gap: 0,
};

/**
 * O binding JS do yoga-layout 3.x não expõe setBaselineFunc: para a folha medida o Yoga
 * usa a altura como baseline. Quando a baseline do Text é lida, o nó vira um invólucro
 * com (1) um marcador de largura 0 e altura = ascent da 1ª linha, com margem inferior
 * −ascent para não ocupar espaço, e (2) a folha com a measure function. A baseline de um
 * contêiner é a do 1º filho, então a do invólucro sai igual ao ascent. O ascent não
 * depende da largura (vem da face do estilo), por isso uma medição basta.
 */
const buildBaselineText = (source: ResolvedText, yoga: YogaNode, ctx: BuildContext): void => {
  applyStyle(yoga, { ...textItemStyleOf(source, ctx), ...BASELINE_WRAPPER });
  const { ascent } = unbounded(source, ctx.env);
  const marker = createChild(yoga, ctx.config);
  applyStyle(marker, { width: 0, height: ascent, flexShrink: 0, margin: { bottom: -ascent } });
  marker.setIsReferenceBaseline(true);
  const leaf = createChild(yoga, ctx.config);
  applyStyle(leaf, { flexShrink: DEFAULTS.item.shrink });
  leaf.setMeasureFunc(textMeasureFunc(source, ctx.env));
};

const buildBox: Builder<ResolvedBox> = (source, yoga, ctx) => {
  applyStyle(yoga, toYogaStyle(source.props, ctx.parent.direction));
  const container = containerOf(source.props);
  const parent: ParentContext = {
    direction: container.direction,
    align: container.align,
    baseline: readsBaseline(source.props, ctx.parent),
  };
  return { source, yoga, children: buildChildren(source.children, yoga, { ...ctx, parent }) };
};

const buildText: Builder<ResolvedText> = (source, yoga, ctx) => {
  if (readsBaseline(source.props, ctx.parent)) {
    buildBaselineText(source, yoga, ctx);
    return { source, yoga, children: [] };
  }
  applyStyle(yoga, textItemStyleOf(source, ctx));
  yoga.setMeasureFunc(textMeasureFunc(source, ctx.env));
  return { source, yoga, children: [] };
};

const buildImage: Builder<ResolvedImage> = (source, yoga, { env, parent }) => {
  const intrinsic = env.imageSize(source.props.src);
  applyStyle(yoga, toImageStyle(source.props, intrinsic, parent.direction));
  return { source, yoga, children: [], intrinsic };
};

// Image/Shape são folhas sem measure function: o Yoga já usa a altura como baseline.
const buildShape: Builder<ResolvedShape> = (source, yoga, { parent }) => {
  applyStyle(yoga, toItemStyle(source.props, parent.direction));
  return { source, yoga, children: [] };
};

const BUILDERS: DispatchTable<ResolvedNode, BuiltNode, [yoga: YogaNode, ctx: BuildContext]> = {
  box: buildBox,
  text: buildText,
  image: buildImage,
  shape: buildShape,
};

const buildNode = (source: ResolvedNode, parent: YogaNode, ctx: BuildContext): BuiltNode =>
  dispatch(BUILDERS, source, createChild(parent, ctx.config), ctx);

/** Cria (e anexa ao `parent`) a subárvore Yoga dos filhos. */
export const buildChildren = (
  children: readonly ResolvedNode[],
  parent: YogaNode,
  ctx: BuildContext,
): readonly BuiltNode[] => children.map((child) => buildNode(child, parent, ctx));
