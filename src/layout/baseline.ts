import { Direction, Unit, type Node as YogaNode } from 'yoga-layout';
import { containerOf } from '../core/defaults.ts';
import type { FlexDirection, ResolvedBox } from '../core/types.ts';
import type { BuiltNode } from './tree.ts';

/**
 * Contorno de um bug do Yoga 3.2.1: numa row com alinhamento por baseline, um filho com
 * tamanho definido no eixo principal (width, ou grow com basis 0) e altura pelo conteúdo
 * não entra na altura da row (ela fica com a do irmão mais baixo). As posições dos filhos
 * saem certas; só a altura da row não. Depois do layout, cada row dessas que tem altura
 * pelo conteúdo recebe a altura que os filhos ocupam e o layout roda de novo.
 */

// Ruído de ponto flutuante do Yoga entre a altura lida e a recalculada.
const LAYOUT_NOISE = 1e-6;

interface BaselineRow {
  readonly built: BuiltNode;
  readonly props: ResolvedBox['props'];
  readonly parentDirection: FlexDirection;
}

const isBaselineRow = (box: ResolvedBox): boolean => {
  const container = containerOf(box.props);
  if (container.direction !== 'row') return false;
  return container.align === 'baseline' || box.children.some((child) => child.props.alignSelf === 'baseline');
};

const baselineRowsOf = (nodes: readonly BuiltNode[], parentDirection: FlexDirection): readonly BaselineRow[] =>
  nodes.flatMap((built) => {
    const { source } = built;
    if (source.kind !== 'box') return [];
    const nested = baselineRowsOf(built.children, containerOf(source.props).direction);
    // height do autor: a altura não vem do conteúdo, o estouro (se houver) é real.
    if (!isBaselineRow(source) || source.props.height !== undefined) return nested;
    return [{ built, props: source.props, parentDirection }, ...nested];
  });

const isInFlow = (built: BuiltNode): boolean => built.source.props.position !== 'absolute';

/** Altura que os filhos em fluxo ocupam (o top já inclui o padding de cima). */
const neededHeightOf = (row: BaselineRow): number => {
  const bottoms = row.built.children.filter(isInFlow).map(({ yoga }) => yoga.getComputedTop() + yoga.getComputedHeight());
  return Math.max(0, ...bottoms) + containerOf(row.props).padding.bottom;
};

/** grow sem height numa column: o flex decide a altura (basis 0), não o conteúdo. */
const isFlexSized = (row: BaselineRow): boolean =>
  row.parentDirection === 'column' && row.props.grow !== undefined && row.props.grow > 0;

/**
 * Em column a altura é o eixo principal: corrige pelo basis, para o shrink ainda poder
 * espremer a row (é assim que o fit enxerga o estouro). Em row (eixo cruzado) ou
 * absoluta, pelo minHeight.
 */
const correct = (row: BaselineRow): boolean => {
  if (isFlexSized(row)) return false;
  const { yoga } = row.built;
  const needed = neededHeightOf(row);
  const inMainAxis = row.parentDirection === 'column' && row.props.position !== 'absolute';
  if (inMainAxis) {
    // Basis em pt já é uma correção anterior; auto só precisa de correção se a altura ficou curta.
    const basis = yoga.getFlexBasis();
    const settled =
      basis.unit === Unit.Point ? Math.abs(basis.value - needed) <= LAYOUT_NOISE : needed <= yoga.getComputedHeight() + LAYOUT_NOISE;
    if (settled) return false;
    yoga.setFlexBasis(needed);
    return true;
  }
  if (needed <= yoga.getComputedHeight() + LAYOUT_NOISE) return false;
  const author = row.props.minHeight;
  yoga.setMinHeight(typeof author === 'number' ? Math.max(author, needed) : needed);
  return true;
};

/**
 * Relayout até as rows estabilizarem. Cada correção de uma row aninhada pode mudar a
 * de fora, então o limite natural é uma rodada por row (mais a primeira).
 */
export const settleBaselineRows = (
  root: YogaNode,
  children: readonly BuiltNode[],
  rootDirection: FlexDirection,
  size: { readonly width: number; readonly height: number },
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
