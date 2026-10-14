import Yoga, {
  Align as YogaAlign,
  type Config,
  FlexDirection as YogaFlexDirection,
  Justify as YogaJustify,
  MeasureMode,
  type MeasureFunction,
  type Node as YogaNode,
} from 'yoga-layout';
import { DEFAULTS } from '../../../src/core/defaults.ts';
import { dispatch, type DispatchTable } from '../../../src/core/dispatch.ts';
import type { Dimensions } from '../../../src/core/types.ts';
import { measureTable } from './table.ts';
import type {
  CssStyle,
  LayoutEnv,
  ResolvedBox,
  ResolvedChart,
  ResolvedImage,
  ResolvedNode,
  ResolvedShape,
  ResolvedTable,
  ResolvedText,
} from '../types.ts';
import { applyStyle } from './apply.ts';
import { gridMeasureFunc } from './grid-layout.ts';
import { measureInputOf } from './measure.ts';
import {
  mainAxisOf,
  readsBaseline,
  toBoxStyle,
  toContainerStyle,
  toImageStyle,
  toItemStyle,
  withLineMinWidth,
  type ParentLayout,
  type YogaStyle,
} from './style.ts';

/** Nó resolvido pareado com seu nó Yoga (e o que foi lido do env na construção). */
export interface BuiltNode {
  readonly source: ResolvedNode;
  readonly yoga: YogaNode;
  /** Na ordem da árvore resolvida (não na de `order`): o read e os paths seguem o autor. */
  readonly children: readonly BuiltNode[];
  readonly intrinsic?: Dimensions;
}

export interface BuildContext {
  readonly config: Config;
  readonly env: LayoutEnv;
  readonly parent: ParentLayout;
}

type Builder<N extends ResolvedNode> = (source: N, yoga: YogaNode, ctx: BuildContext) => BuiltNode;

export const parentLayoutOf = (css: CssStyle, baseline: boolean): ParentLayout => ({
  direction: css.display === 'block' ? 'column' : mainAxisOf(css),
  display: css.display,
  alignItems: css.alignItems,
  baseline,
});

const textMeasureFunc =
  (source: ResolvedText, env: LayoutEnv): MeasureFunction =>
  (width, widthMode) => {
    const maxWidth = widthMode === MeasureMode.Undefined ? Number.POSITIVE_INFINITY : width;
    const text = env.measureText(measureInputOf(source, maxWidth));
    if (widthMode === MeasureMode.Exactly) return { width, height: text.height };
    if (widthMode === MeasureMode.AtMost) return { width: Math.min(text.width, width), height: text.height };
    return { width: text.width, height: text.height };
  };

const unbounded = (source: ResolvedText, env: LayoutEnv) => env.measureText(measureInputOf(source, Number.POSITIVE_INFINITY));

const horizontalBoxOf = (css: CssStyle): number =>
  css.border.left.width + css.border.right.width + (typeof css.padding.left === 'number' ? css.padding.left : 0) + (typeof css.padding.right === 'number' ? css.padding.right : 0);

const textItemStyleOf = (source: ResolvedText, { env, parent }: BuildContext): YogaStyle => {
  const style = { ...toItemStyle(source.css, parent, true), ...toBoxStyle(source.css) };
  if (source.props.nowrap !== true || parent.direction !== 'row') return style;
  return withLineMinWidth(style, unbounded(source, env).width + horizontalBoxOf(source.css));
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
  rowGap: 0,
  columnGap: 0,
};

/**
 * Baseline do Text (cópia de src/layout/tree.ts): o binding JS do Yoga não expõe
 * setBaselineFunc, então o Text vira um invólucro com um marcador de altura = ascent
 * (referência de baseline) e a folha medida.
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

/** Grid: folha medida pela grade; os itens são posicionados depois, no read (grid-layout.ts). */
const buildGrid: Builder<ResolvedBox> = (source, yoga, ctx) => {
  applyStyle(yoga, { ...toItemStyle(source.css, ctx.parent), ...toBoxStyle(source.css) });
  yoga.setMeasureFunc(gridMeasureFunc(source, ctx.env));
  return { source, yoga, children: [] };
};

const buildBox: Builder<ResolvedBox> = (source, yoga, ctx) => {
  if (source.css.display === 'grid') return buildGrid(source, yoga, ctx);
  applyStyle(yoga, { ...toItemStyle(source.css, ctx.parent), ...toContainerStyle(source.css) });
  const parent = parentLayoutOf(source.css, readsBaseline(source.css, ctx.parent));
  return { source, yoga, children: buildChildren(source.children, yoga, { ...ctx, parent }, source.css) };
};

const buildText: Builder<ResolvedText> = (source, yoga, ctx) => {
  if (readsBaseline(source.css, ctx.parent)) {
    buildBaselineText(source, yoga, ctx);
    return { source, yoga, children: [] };
  }
  applyStyle(yoga, textItemStyleOf(source, ctx));
  yoga.setMeasureFunc(textMeasureFunc(source, ctx.env));
  return { source, yoga, children: [] };
};

const buildImage: Builder<ResolvedImage> = (source, yoga, { env, parent }) => {
  const intrinsic = env.imageSize(source.props.src);
  applyStyle(yoga, toImageStyle(source.css, intrinsic, parent));
  return { source, yoga, children: [], intrinsic };
};

const buildLeaf: Builder<ResolvedShape | ResolvedChart> = (source, yoga, { parent }) => {
  applyStyle(yoga, { ...toItemStyle(source.css, parent), ...toBoxStyle(source.css) });
  return { source, yoga, children: [] };
};

/** Mesma medida da engine (src/layout/tree.ts): largura natural sem limite, altura na largura escolhida. */
const tableMeasureFunc =
  (source: ResolvedTable, env: LayoutEnv): MeasureFunction =>
  (width, widthMode) => {
    if (widthMode === MeasureMode.Exactly) return { width, height: measureTable(source, width, env).height };
    const natural = measureTable(source, Number.POSITIVE_INFINITY, env).width;
    const limit = widthMode === MeasureMode.AtMost && Number.isFinite(width) ? width : Number.POSITIVE_INFINITY;
    const chosen = Math.min(natural, limit);
    return { width: chosen, height: measureTable(source, chosen, env).height };
  };

const buildTable: Builder<ResolvedTable> = (source, yoga, { env, parent }) => {
  applyStyle(yoga, { ...toItemStyle(source.css, parent, true), ...toBoxStyle(source.css) });
  yoga.setMeasureFunc(tableMeasureFunc(source, env));
  return { source, yoga, children: [] };
};

const BUILDERS: DispatchTable<ResolvedNode, BuiltNode, [yoga: YogaNode, ctx: BuildContext]> = {
  box: buildBox,
  text: buildText,
  image: buildImage,
  shape: buildLeaf,
  chart: buildLeaf,
  table: buildTable,
};

const isInFlow = (node: ResolvedNode): boolean => node.css.position !== 'absolute';

/**
 * Colapso de margens verticais entre irmãos em block (CSS 2.1 §8.3.1, só entre irmãos):
 * a margem efetiva entre dois blocos é max(positivas) + min(negativas). O Yoga soma as duas,
 * então a margem de cima do segundo vira `colapsada − margem de baixo do primeiro`.
 * Margem de pai com filho não colapsa nesta PoC.
 */
const collapsedTopsOf = (children: readonly ResolvedNode[]): ReadonlyMap<ResolvedNode, number> => {
  const flow = children.filter(isInFlow);
  return new Map(
    flow.slice(1).flatMap((child, index) => {
      const previous = flow[index]!.css.margin.bottom;
      const own = child.css.margin.top;
      if (typeof previous !== 'number' || (typeof own !== 'number' && own !== 'auto')) return [];
      const top = own === 'auto' ? 0 : own;
      const collapsed = Math.max(0, previous, top) + Math.min(0, previous, top);
      return [[child, collapsed - previous] as const];
    }),
  );
};

/** `order` muda a ordem do fluxo (estável); os BuiltNode voltam na ordem da árvore. */
const flowOrderOf = (children: readonly ResolvedNode[]): readonly ResolvedNode[] =>
  children
    .map((child, index) => ({ child, index }))
    .sort((a, b) => a.child.css.order - b.child.css.order || a.index - b.index)
    .map(({ child }) => child);

const buildNode = (source: ResolvedNode, parent: YogaNode, ctx: BuildContext): BuiltNode =>
  dispatch(BUILDERS, source, createChild(parent, ctx.config), ctx);

/** Cria (e anexa ao `parent`) a subárvore Yoga dos filhos de um contêiner com estilo `css`. */
export const buildChildren = (
  children: readonly ResolvedNode[],
  parent: YogaNode,
  ctx: BuildContext,
  css: CssStyle,
): readonly BuiltNode[] => {
  const collapsed = css.display === 'block' ? collapsedTopsOf(children) : new Map<ResolvedNode, number>();
  const built = new Map(
    flowOrderOf(children).map((child) => {
      const node = buildNode(child, parent, ctx);
      const top = collapsed.get(child);
      if (top !== undefined) applyStyle(node.yoga, { margin: { top } });
      return [child, node] as const;
    }),
  );
  return children.map((child) => built.get(child)!);
};
