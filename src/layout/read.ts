import type { Node as YogaNode } from 'yoga-layout';
import { tableStyleOf } from '../core/defaults.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type {
  BoxMetrics,
  CssStyle,
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
import { readSides } from './apply.ts';
import { layoutGridChildren } from './grid-layout.ts';
import { measureInputOf } from './measure.ts';
import { mainAxisOf } from './style.ts';
import { measureTable } from './table.ts';
import type { BuiltNode } from './tree.ts';

interface Origin {
  readonly x: number;
  readonly y: number;
}

/**
 * O Yoga devolve posições relativas ao pai; o contrato quer frames absolutos no slide.
 * `translate` (transform) é aplicado aqui, depois do layout, sem afetar irmãos (como o browser).
 */
export const frameOf = (yoga: YogaNode, origin: Origin, source: ResolvedNode): Rect => {
  const { left, top, width, height } = yoga.getComputedLayout();
  const { x, y } = source.css.translate;
  return { x: origin.x + left + x, y: origin.y + top + y, width, height };
};

export const boxOf = (yoga: YogaNode): BoxMetrics => ({
  margin: readSides((edge) => yoga.getComputedMargin(edge)),
  border: readSides((edge) => yoga.getComputedBorder(edge)),
  padding: readSides((edge) => yoga.getComputedPadding(edge)),
});

/** Área de conteúdo: frame − borda − padding. */
export const contentRectOf = (frame: Rect, box: BoxMetrics): Rect => ({
  x: frame.x + box.border.left + box.padding.left,
  y: frame.y + box.border.top + box.padding.top,
  width: Math.max(0, frame.width - box.border.left - box.border.right - box.padding.left - box.padding.right),
  height: Math.max(0, frame.height - box.border.top - box.border.bottom - box.padding.top - box.padding.bottom),
});

type Reader<N extends ResolvedNode> = (
  source: N,
  built: BuiltNode,
  frame: Rect,
  env: LayoutEnv,
) => Extract<PositionedNode, { kind: N['kind'] }>;

const numeric = (value: unknown): number => (typeof value === 'number' ? value : 0);

/**
 * Contorno de bug do Yoga 3.2.1: com flex-wrap, item alinhado em start ignora a margem do
 * início do eixo cruzado e em center ignora as duas (a altura da linha já conta com elas;
 * end e stretch saem certos). Medido em H4 (caso F02) e isolado num teste direto do Yoga.
 */
const wrapCrossOffsetOf = (container: CssStyle, child: ResolvedNode): Origin => {
  if (container.display !== 'flex' || container.flexWrap === 'nowrap' || child.css.position === 'absolute') return { x: 0, y: 0 };
  const align = child.css.alignSelf ?? container.alignItems;
  const row = mainAxisOf(container) === 'row';
  const [leading, trailing] = row ? [child.css.margin.top, child.css.margin.bottom] : [child.css.margin.left, child.css.margin.right];
  const offset = align === 'flex-start' ? numeric(leading) : align === 'center' ? (numeric(leading) - numeric(trailing)) / 2 : 0;
  return row ? { x: 0, y: offset } : { x: offset, y: 0 };
};

const readBox: Reader<ResolvedBox> = (source, built, frame, env) => {
  const box = boxOf(built.yoga);
  if (source.css.display === 'grid') return { ...source, frame, box, children: layoutGridChildren(source, frame, box, env) };
  const children = built.children.map((child) => {
    const fix = wrapCrossOffsetOf(source.css, child.source);
    return readNode(child, { x: frame.x + fix.x, y: frame.y + fix.y }, env);
  });
  return { ...source, frame, box, children };
};

// As linhas finais são medidas de novo com a largura definitiva da área de conteúdo.
const readText: Reader<ResolvedText> = (source, built, frame, env) => {
  const box = boxOf(built.yoga);
  return { ...source, frame, box, text: env.measureText(measureInputOf(source, contentRectOf(frame, box).width)) };
};

const readImage: Reader<ResolvedImage> = (source, built, frame, env) => ({
  ...source,
  frame,
  box: boxOf(built.yoga),
  intrinsic: built.intrinsic ?? env.imageSize(source.props.src),
});

const readShape: Reader<ResolvedShape> = (source, built, frame) => ({ ...source, frame, box: boxOf(built.yoga) });

const readChart: Reader<ResolvedChart> = (source, built, frame) => ({ ...source, frame, box: boxOf(built.yoga) });

const readTable: Reader<ResolvedTable> = (source, built, frame, env) => {
  const box = boxOf(built.yoga);
  const { columnWidths, rowHeights, cells, height } = measureTable(source, contentRectOf(frame, box).width, env);
  return { ...source, frame, box, fontSize: tableStyleOf(source.props).size, columnWidths, rowHeights, cells, height };
};

const READERS: DispatchTable<ResolvedNode, PositionedNode, [built: BuiltNode, frame: Rect, env: LayoutEnv]> = {
  box: readBox,
  text: readText,
  image: readImage,
  shape: readShape,
  chart: readChart,
  table: readTable,
  path: (source, built, frame) => ({ ...source, frame, box: boxOf(built.yoga) }),
  icon: (source, built, frame) => ({ ...source, frame, box: boxOf(built.yoga) }),
};

const readNode = (built: BuiltNode, origin: Origin, env: LayoutEnv): PositionedNode =>
  dispatch(READERS, built.source, built, frameOf(built.yoga, origin, built.source), env);

export const readChildren = (children: readonly BuiltNode[], origin: Origin, env: LayoutEnv): readonly PositionedNode[] =>
  children.map((child) => readNode(child, origin, env));
