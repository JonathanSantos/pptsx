import { DEFAULTS, tableHeaderOf, tableStyleOf } from '../core/defaults.ts';
import type { LayoutEnv, ResolvedBox, ResolvedNode, ResolvedTable, ResolvedText } from '../core/types.ts';
import { measureInputOf } from './measure.ts';
import { mainAxisOf } from './style.ts';

/**
 * Largura min-content (CSS Sizing §5) de uma subárvore, pura. O Yoga não tem min-content,
 * e o grid precisa dela para a base dos tracks `auto`/`1fr`. Regras:
 * - Text: o maior trecho indivisível (com a folga do textSafety, como o layout quebra);
 * - Box: row sem wrap soma os filhos (+ gaps); row com wrap, column e block pegam o maior;
 * - grid aninhado: o próprio grid dimensionado sem espaço (min-content da grade);
 * - width numérica do autor vence; Image/Shape/Chart sem width = 0 (como `max-width: 100%`).
 */

const numeric = (value: unknown): number => (typeof value === 'number' ? value : 0);

export const horizontalBoxOf = (node: ResolvedNode): number =>
  node.css.border.left.width + node.css.border.right.width + numeric(node.css.padding.left) + numeric(node.css.padding.right);

export const horizontalMarginOf = (node: ResolvedNode): number => numeric(node.css.margin.left) + numeric(node.css.margin.right);

const clamp = (value: number, node: ResolvedNode): number => {
  const min = typeof node.css.minWidth === 'number' ? node.css.minWidth : 0;
  const max = typeof node.css.maxWidth === 'number' ? node.css.maxWidth : Number.POSITIVE_INFINITY;
  return Math.max(min, Math.min(max, value));
};

const textMin = (node: ResolvedText, env: LayoutEnv): number => {
  const text = env.measureText(measureInputOf(node, Number.POSITIVE_INFINITY));
  if (node.props.nowrap === true) return text.width;
  return text.widestSegment / (env.textSafety ?? DEFAULTS.textSafety);
};

const tableMin = (node: ResolvedTable, env: LayoutEnv): number => {
  const padding = 2 * (node.props.cellPadding ?? DEFAULTS.table.cellPadding);
  const style = tableStyleOf(node.props);
  const header = tableHeaderOf(node.props);
  const rows = [...(header === undefined ? [] : [node.props.columns.map((column) => column.header)]), ...node.rows];
  return node.props.columns.reduce((total, column, index) => {
    if (typeof column.width === 'number') return total + column.width;
    const widest = Math.max(0, ...rows.map((row) => env.measureText({ content: row[index] ?? '', style, maxWidth: Number.POSITIVE_INFINITY }).widestSegment));
    return total + widest + padding;
  }, 0);
};

const inFlow = (node: ResolvedNode): boolean => node.css.position !== 'absolute';

const boxMin = (node: ResolvedBox, env: LayoutEnv, gridMin: (box: ResolvedBox) => number): number => {
  if (node.css.display === 'grid') return gridMin(node);
  const children = node.children.filter(inFlow).map((child) => minContentWidthOf(child, env, gridMin) + horizontalMarginOf(child));
  const row = node.css.display !== 'block' && mainAxisOf(node.css) === 'row';
  if (row && node.css.flexWrap === 'nowrap') return children.reduce((a, b) => a + b, 0) + node.css.columnGap * Math.max(0, children.length - 1);
  return Math.max(0, ...children);
};

/** Min-content do border-box (sem margens). `gridMin` vem do grid-layout (evita import circular). */
export const minContentWidthOf = (node: ResolvedNode, env: LayoutEnv, gridMin: (box: ResolvedBox) => number): number => {
  if (typeof node.css.width === 'number') return node.css.width;
  const box = horizontalBoxOf(node);
  switch (node.kind) {
    case 'text':
      return clamp(textMin(node, env) + box, node);
    case 'table':
      return clamp(tableMin(node, env) + box, node);
    case 'box':
      return clamp(boxMin(node, env, gridMin) + box, node);
    default:
      return clamp(box, node);
  }
};
