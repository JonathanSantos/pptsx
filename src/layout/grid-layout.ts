import Yoga, {
  Align as YogaAlign,
  Direction,
  FlexDirection as YogaFlexDirection,
  Justify as YogaJustify,
  MeasureMode,
  PositionType,
  type MeasureFunction,
} from 'yoga-layout';
import type { BoxMetrics, CssAlign, CssPlace, CssStyle, LayoutEnv, PositionedNode, Rect, ResolvedBox, ResolvedNode } from '../core/types.ts';
import { applyStyle } from './apply.ts';
import { settleBaselineRows } from './baseline.ts';
import { createConfig } from './config.ts';
import {
  areaRect,
  parseAutoTracks,
  parseTrackList,
  placeItems,
  sizeTracks,
  totalOf,
  tracksFor,
  type Area,
  type SizingItem,
} from './grid.ts';
import { horizontalMarginOf, minContentWidthOf } from './intrinsic.ts';
import { contentRectOf, readChildren } from './read.ts';
import type { ParentLayout, YogaStyle } from './style.ts';
import { buildChildren, type BuiltNode } from './tree.ts';

/**
 * Grid ↔ Yoga. O contêiner grid é uma folha do Yoga com measure function (largura → altura
 * pela grade); os itens NÃO entram na árvore principal. Depois do layout, cada item é
 * posicionado na sua área por uma árvore Yoga própria do tamanho da área (o grid só decide
 * as áreas; dentro delas o item é uma caixa comum). Contribuições dos itens: min-content
 * (intrinsic.ts), max-content e altura numa largura (Yoga isolado).
 */

/** Contêiner que dispõe filhos em grade (Box ou Slide). */
export interface GridContainer {
  readonly css: CssStyle;
  readonly children: readonly ResolvedNode[];
}

export interface GridModel {
  readonly columns: readonly number[];
  readonly rows: readonly number[];
  /** Uma área por filho em fluxo, na ordem de `items`. */
  readonly areas: readonly Area[];
  readonly items: readonly ResolvedNode[];
}

const inFlow = (node: ResolvedNode): boolean => node.css.position !== 'absolute';

const numeric = (value: unknown): number => (typeof value === 'number' ? value : 0);

const verticalMarginOf = (node: ResolvedNode): number => numeric(node.css.margin.top) + numeric(node.css.margin.bottom);

const ROW_PARENT: ParentLayout = { direction: 'row', display: 'flex', alignItems: 'stretch', baseline: false };
const COLUMN_PARENT: ParentLayout = { direction: 'column', display: 'flex', alignItems: 'stretch', baseline: false };

/** Árvore Yoga descartável com um único item; libera tudo antes de devolver. */
const withIsolated = <T>(
  item: ResolvedNode,
  container: CssStyle,
  root: YogaStyle,
  parent: ParentLayout,
  size: { readonly width: number | undefined; readonly height: number | undefined },
  env: LayoutEnv,
  use: (built: BuiltNode) => T,
  adjust: (built: BuiltNode) => void = () => undefined,
): T => {
  const config = createConfig();
  const yoga = Yoga.Node.create(config);
  try {
    applyStyle(yoga, root);
    const [built] = buildChildren([item], yoga, { config, env, parent }, container);
    adjust(built!);
    yoga.calculateLayout(size.width, size.height, Direction.LTR);
    settleBaselineRows(yoga, [built!], parent.direction, size);
    return use(built!);
  } finally {
    yoga.freeRecursive();
    config.free();
  }
};

/** Largura max-content (border-box): o item sozinho, sem limite de largura. */
const maxContentWidthOf = (item: ResolvedNode, container: CssStyle, env: LayoutEnv): number =>
  withIsolated(
    item,
    container,
    { flexDirection: YogaFlexDirection.Column, alignItems: YogaAlign.FlexStart },
    { ...COLUMN_PARENT, alignItems: 'flex-start' },
    { width: undefined, height: undefined },
    env,
    (built) => built.yoga.getComputedWidth(),
  );

const isWidthAuto = (item: ResolvedNode): boolean => item.css.width === undefined;

const hasAutoInlineMargin = (item: ResolvedNode): boolean => item.css.margin.left === 'auto' || item.css.margin.right === 'auto';

const justifyOf = (item: ResolvedNode, container: CssStyle): CssPlace => item.css.justifySelf ?? container.justifyItems ?? 'stretch';

const alignOf = (item: ResolvedNode, container: CssStyle): CssAlign => item.css.alignSelf ?? container.alignItems;

/** justify-self stretch só estica sem width do autor e sem margem auto (CSS Box Alignment §6.1). */
const stretchesInline = (item: ResolvedNode, container: CssStyle): boolean =>
  justifyOf(item, container) === 'stretch' && isWidthAuto(item) && !hasAutoInlineMargin(item);

/** Altura (com margens) do item numa área de largura `width`, como ele vai ficar na célula. */
const heightIn = (item: ResolvedNode, width: number, container: CssStyle, env: LayoutEnv): number =>
  withIsolated(
    item,
    container,
    {
      width,
      flexDirection: YogaFlexDirection.Column,
      alignItems: stretchesInline(item, container) ? YogaAlign.Stretch : YogaAlign.FlexStart,
    },
    { ...COLUMN_PARENT, alignItems: stretchesInline(item, container) ? 'stretch' : 'flex-start' },
    { width, height: undefined },
    env,
    (built) => built.yoga.getComputedHeight(),
    (built) => applyStyle(built.yoga, { flexShrink: 0, flexGrow: 0 }),
  ) + verticalMarginOf(item);

const explicitOf = (text: string | undefined) => parseTrackList(text) ?? [];

/**
 * Dimensiona a grade: placement, colunas (com `width` disponível ou indefinida) e depois as
 * linhas, com a altura de cada item medida na largura da sua área (§11.1: colunas primeiro).
 */
export const gridModelOf = (container: GridContainer, env: LayoutEnv, width: number | undefined, height: number | undefined): GridModel => {
  const { css } = container;
  const items = container.children.filter(inFlow);
  const explicitColumns = explicitOf(css.gridTemplateColumns);
  const explicitRows = explicitOf(css.gridTemplateRows);
  const placed = placeItems(items.map((item) => ({ column: item.css.gridColumn, row: item.css.gridRow })), explicitColumns.length, explicitRows.length);
  const columnTracks = tracksFor(explicitColumns, parseAutoTracks(css.gridAutoColumns), placed.columns);
  const rowTracks = tracksFor(explicitRows, parseAutoTracks(css.gridAutoRows), placed.rows);
  const gridMin = (box: ResolvedBox): number => totalOf(gridModelOf(box, env, 0, undefined).columns, box.css.columnGap);
  const columnItems: readonly SizingItem[] = items.map((item, index) => {
    const area = placed.areas[index]!;
    const margin = horizontalMarginOf(item);
    const min = minContentWidthOf(item, env, gridMin) + margin;
    const max = Math.max(min, maxContentWidthOf(item, css, env) + margin);
    return { start: area.columnStart, end: area.columnEnd, contribution: { min, max } };
  });
  const columns = sizeTracks(columnTracks, columnItems, width, css.columnGap);
  const rowItems: readonly SizingItem[] = items.map((item, index) => {
    const area = placed.areas[index]!;
    const areaWidth = areaRect(area, columns, rowTracks.map(() => 0), css.columnGap, 0).width;
    const itemHeight = heightIn(item, Math.max(0, areaWidth - horizontalMarginOf(item)), css, env);
    return { start: area.rowStart, end: area.rowEnd, contribution: { min: itemHeight, max: itemHeight } };
  });
  const rows = sizeTracks(rowTracks, rowItems, height, css.rowGap);
  return { columns, rows, areas: placed.areas, items };
};

/** Measure function do contêiner grid: tamanho de conteúdo pela grade. */
export const gridMeasureFunc =
  (container: GridContainer, env: LayoutEnv): MeasureFunction =>
  (width, widthMode, height, heightMode) => {
    const definiteHeight = heightMode === MeasureMode.Exactly ? height : undefined;
    const definiteWidth = widthMode === MeasureMode.Exactly ? width : undefined;
    const natural = gridModelOf(container, env, definiteWidth, definiteHeight);
    const naturalWidth = totalOf(natural.columns, container.css.columnGap);
    // fit-content: a grade não passa do limite (as colunas fr/auto se reajustam a ele).
    const limited = widthMode === MeasureMode.AtMost && naturalWidth > width;
    const model = limited ? gridModelOf(container, env, width, definiteHeight) : natural;
    const usedWidth = widthMode === MeasureMode.Exactly || limited ? width : naturalWidth;
    return { width: usedWidth, height: definiteHeight ?? totalOf(model.rows, container.css.rowGap) };
  };

const JUSTIFY_IN_AREA: Readonly<Record<CssPlace, YogaJustify>> = {
  start: YogaJustify.FlexStart,
  center: YogaJustify.Center,
  end: YogaJustify.FlexEnd,
  stretch: YogaJustify.FlexStart,
};

const ALIGN_IN_AREA: Readonly<Record<CssAlign, YogaAlign>> = {
  'flex-start': YogaAlign.FlexStart,
  center: YogaAlign.Center,
  'flex-end': YogaAlign.FlexEnd,
  stretch: YogaAlign.Stretch,
  baseline: YogaAlign.FlexStart,
};

/** O item numa árvore do tamanho da área: row com justify/align do grid; stretch na horizontal = grow. */
const placeInArea = (item: ResolvedNode, area: Rect, container: CssStyle, env: LayoutEnv): PositionedNode => {
  const align = alignOf(item, container);
  const stretch = stretchesInline(item, container);
  return withIsolated(
    item,
    container,
    {
      width: area.width,
      height: area.height,
      flexDirection: YogaFlexDirection.Row,
      justifyContent: JUSTIFY_IN_AREA[justifyOf(item, container)],
      alignItems: ALIGN_IN_AREA[align],
    },
    { ...ROW_PARENT, alignItems: align === 'baseline' ? 'flex-start' : align },
    { width: area.width, height: area.height },
    env,
    (built) => ({ ...readChildren([built], area, env)[0]!, cell: area }),
    (built) => applyStyle(built.yoga, stretch ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }),
  );
};

/** Absoluto num grid: posicionado pela caixa de padding do contêiner (sem área definida). */
const placeAbsolute = (item: ResolvedNode, padding: Rect, container: CssStyle, env: LayoutEnv): PositionedNode =>
  withIsolated(
    item,
    container,
    { width: padding.width, height: padding.height, flexDirection: YogaFlexDirection.Column },
    COLUMN_PARENT,
    { width: padding.width, height: padding.height },
    env,
    (built) => readChildren([built], padding, env)[0]!,
    (built) => applyStyle(built.yoga, { positionType: PositionType.Absolute }),
  );

const paddingRectOf = (frame: Rect, box: BoxMetrics): Rect => ({
  x: frame.x + box.border.left,
  y: frame.y + box.border.top,
  width: Math.max(0, frame.width - box.border.left - box.border.right),
  height: Math.max(0, frame.height - box.border.top - box.border.bottom),
});

/** Filhos posicionados de um contêiner grid já com frame final (ordem da árvore). */
export const layoutGridChildren = (container: GridContainer, frame: Rect, box: BoxMetrics, env: LayoutEnv): readonly PositionedNode[] => {
  const content = contentRectOf(frame, box);
  const model = gridModelOf(container, env, content.width, content.height);
  const areaOf = new Map(model.items.map((item, index) => [item, model.areas[index]!] as const));
  return container.children.map((child) => {
    const area = areaOf.get(child);
    if (area === undefined) return placeAbsolute(child, paddingRectOf(frame, box), container.css, env);
    const rect = areaRect(area, model.columns, model.rows, container.css.columnGap, container.css.rowGap);
    return placeInArea(child, { ...rect, x: content.x + rect.x, y: content.y + rect.y }, container.css, env);
  });
};

