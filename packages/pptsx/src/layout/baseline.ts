import { Direction, Edge, Unit, type Node as YogaNode } from 'yoga-layout';
import { DEFAULTS } from '../core/defaults.ts';
import type { FlexDirection, ResolvedBox } from '../core/types.ts';
import { mainAxisOf } from './style.ts';
import type { BuiltNode } from './tree.ts';

/**
 * Contorno de um bug do Yoga 3.2.1: numa row com alinhamento por baseline, um filho com
 * tamanho definido no eixo principal (width, ou grow com basis 0) e altura pelo conteúdo
 * não entra na altura da row (ela fica com a do irmão mais baixo). As posições dos filhos
 * saem certas; só a altura da row não. Depois do layout, cada row dessas que tem altura
 * pelo conteúdo recebe a altura que os filhos ocupam e o layout roda de novo.
 */

interface BaselineRow {
  readonly built: BuiltNode;
  readonly box: ResolvedBox;
  readonly parentDirection: FlexDirection;
}

const isBaselineRow = (box: ResolvedBox): boolean => {
  if (box.css.display === 'block' || mainAxisOf(box.css) !== 'row') return false;
  return box.css.alignItems === 'baseline' || box.children.some((child) => child.css.alignSelf === 'baseline');
};

const baselineRowsOf = (nodes: readonly BuiltNode[], parentDirection: FlexDirection): readonly BaselineRow[] =>
  nodes.flatMap((built) => {
    const { source } = built;
    if (source.kind !== 'box') return [];
    const nested = baselineRowsOf(built.children, source.css.display === 'block' ? 'column' : mainAxisOf(source.css));
    if (!isBaselineRow(source) || source.css.height !== undefined) return nested;
    return [{ built, box: source, parentDirection }, ...nested];
  });

const isInFlow = (built: BuiltNode): boolean => built.source.css.position !== 'absolute';

const neededHeightOf = (row: BaselineRow): number => {
  const bottoms = row.built.children.filter(isInFlow).map(({ yoga }) => yoga.getComputedTop() + yoga.getComputedHeight());
  const { yoga } = row.built;
  return Math.max(0, ...bottoms) + yoga.getComputedPadding(Edge.Bottom) + yoga.getComputedBorder(Edge.Bottom);
};

const isFlexSized = (row: BaselineRow): boolean => row.parentDirection === 'column' && row.box.css.flexGrow > 0;

const correct = (row: BaselineRow): boolean => {
  if (isFlexSized(row)) return false;
  const { yoga } = row.built;
  const needed = neededHeightOf(row);
  const inMainAxis = row.parentDirection === 'column' && row.box.css.position !== 'absolute';
  if (inMainAxis) {
    const basis = yoga.getFlexBasis();
    const settled =
      basis.unit === Unit.Point
        ? Math.abs(basis.value - needed) <= DEFAULTS.css.layoutNoise
        : needed <= yoga.getComputedHeight() + DEFAULTS.css.layoutNoise;
    if (settled) return false;
    yoga.setFlexBasis(needed);
    return true;
  }
  if (needed <= yoga.getComputedHeight() + DEFAULTS.css.layoutNoise) return false;
  const author = row.box.css.minHeight;
  yoga.setMinHeight(typeof author === 'number' ? Math.max(author, needed) : needed);
  return true;
};

export const settleBaselineRows = (
  root: YogaNode,
  children: readonly BuiltNode[],
  rootDirection: FlexDirection,
  size: { readonly width: number | undefined; readonly height: number | undefined },
): void => {
  const rows = baselineRowsOf(children, rootDirection);
  const settle = (remaining: number): void => {
    if (remaining <= 0) return;
    const changed = rows.map(correct).some(Boolean);
    if (!changed) return;
    root.calculateLayout(size.width, size.height, Direction.LTR);
    settle(remaining - 1);
  };
  settle(rows.length);
};
