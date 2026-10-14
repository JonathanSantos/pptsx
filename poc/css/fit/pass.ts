// PoC CSS: cópia de src/fit/pass.ts com os tipos da PoC (nós com css); adaptações marcadas com 'PoC:'.
import { fitPolicyOf, minSizeOf, tableFitOf, tableMinSizeOf, tableStyleOf, textStyleOf } from '../../../src/core/defaults.ts';
import type {
  LayoutEnv,
  PositionedNode,
  PositionedSlide,
  PositionedTable,
  PositionedText,
  Pt,
  ResolvedNode,
  ResolvedSlide,
  ResolvedTable,
  ResolvedText,
  SlideSize,
} from '../types.ts';
import { layoutSlide } from '../layout/index.ts';
import { detectOverflow, isWidthOverflow } from './detect.ts';
import type { Overflow } from './detect.ts';
import { POLICIES } from './policies.ts';
import type { OverflowPolicy } from './policies.ts';
import { isPositionedShrinkable, isResolvedShrinkable, shrinkableOf } from './shrinkable.ts';
import type { ResolvedShrinkable, Shrinkable } from './shrinkable.ts';

// Uma tentativa do ajuste (árvore resolvida + layout + estouros) e o que vale para cada Text/Table.

export interface LayoutInput {
  readonly size: SlideSize;
  readonly env: LayoutEnv;
}

/**
 * O que vale para o Text (ou Table) durante todo o ajuste, lido das props ORIGINAIS do
 * autor. A busca só usa `triggersShrink`/`resize` da política; os diagnósticos da Table
 * são próprios (ver table.ts).
 */
export interface ShrinkPlan {
  readonly from: Pt;
  /** Nunca acima de `from`: o ajuste não aumenta texto que o autor já fez menor que o piso. */
  readonly min: Pt;
  readonly policy: OverflowPolicy;
}

export type Plans = ReadonlyMap<string, ShrinkPlan>;

export interface Pass {
  readonly resolved: ResolvedSlide;
  readonly positioned: PositionedSlide;
  readonly overflows: readonly Overflow[];
}

export const sizeOf = (text: ResolvedText): Pt => textStyleOf(text.props).size;

const resolvedLeaves = <N extends ResolvedNode>(nodes: readonly ResolvedNode[], guard: (node: ResolvedNode) => node is N): readonly N[] =>
  nodes.flatMap((node) => {
    if (node.kind === 'box') return resolvedLeaves(node.children, guard);
    return guard(node) ? [node] : [];
  });

const isResolvedText = (node: ResolvedNode): node is ResolvedText => node.kind === 'text';
const isResolvedTable = (node: ResolvedNode): node is ResolvedTable => node.kind === 'table';

export const resolvedTexts = (nodes: readonly ResolvedNode[]): readonly ResolvedText[] => resolvedLeaves(nodes, isResolvedText);

export const resolvedTables = (nodes: readonly ResolvedNode[]): readonly ResolvedTable[] => resolvedLeaves(nodes, isResolvedTable);

/** Text e Table na ordem do slide. */
export const resolvedShrinkables = (nodes: readonly ResolvedNode[]): readonly ResolvedShrinkable[] =>
  resolvedLeaves(nodes, isResolvedShrinkable);

export const positionedNodes = (nodes: readonly PositionedNode[]): readonly PositionedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...positionedNodes(node.children)] : [node]));

const isPositionedText = (node: PositionedNode): node is PositionedText => node.kind === 'text';

export const positionedTexts = (pass: Pass): readonly PositionedText[] =>
  positionedNodes(pass.positioned.children).filter(isPositionedText);

const isPositionedTable = (node: PositionedNode): node is PositionedTable => node.kind === 'table';

export const positionedTables = (pass: Pass): readonly PositionedTable[] =>
  positionedNodes(pass.positioned.children).filter(isPositionedTable);

/** Visão comum (ver shrinkable.ts) de cada Text e Table posicionado, na ordem do slide. */
export const positionedShrinkables = (pass: Pass): readonly Shrinkable[] =>
  positionedNodes(pass.positioned.children).filter(isPositionedShrinkable).map(shrinkableOf);

const textPlanOf = (text: ResolvedText): ShrinkPlan => {
  const from = sizeOf(text);
  return { from, min: Math.min(from, minSizeOf(text.props)), policy: POLICIES[fitPolicyOf(text.props)] };
};

// TableFitPolicy ⊂ FitPolicy: shrink desce como o Text, error não encolhe.
const tablePlanOf = (table: ResolvedTable): ShrinkPlan => {
  const from = tableStyleOf(table.props).size;
  return { from, min: Math.min(from, tableMinSizeOf(table.props)), policy: POLICIES[tableFitOf(table.props)] };
};

const planOf = (node: ResolvedShrinkable): ShrinkPlan => (node.kind === 'table' ? tablePlanOf(node) : textPlanOf(node));

export const plansOf = (slide: ResolvedSlide): Plans =>
  new Map(resolvedShrinkables(slide.children).map((node) => [node.path, planOf(node)]));

export const passOf = (resolved: ResolvedSlide, input: LayoutInput): Pass => {
  const positioned = layoutSlide(resolved, input.size, input.env);
  return { resolved, positioned, overflows: detectOverflow(positioned) };
};

const isText = (overflow: Overflow): boolean => overflow.kind === 'text';
const isTable = (overflow: Overflow): boolean => overflow.kind === 'table';

const byPath = (overflows: readonly Overflow[]): ReadonlyMap<string, Overflow> =>
  new Map(overflows.map((overflow) => [overflow.path, overflow]));

/** Estouros de altura dos Text (um Text pode ter também um de largura: mapas separados). */
export const textOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> =>
  byPath(pass.overflows.filter((overflow) => isText(overflow) && !isWidthOverflow(overflow)));

export const tableOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> => byPath(pass.overflows.filter(isTable));

/** Estouros de altura de Text e Table: o que dispara a busca mesmo no mínimo. */
export const heightOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> =>
  byPath(pass.overflows.filter((overflow) => isTable(overflow) || (isText(overflow) && !isWidthOverflow(overflow))));

/** Estouros de largura (Text com nowrap). */
export const widthOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> =>
  byPath(pass.overflows.filter((overflow) => isText(overflow) && isWidthOverflow(overflow)));

/** Text/Table com qualquer estouro: não contam para o box do pai (mesma regra da detecção). */
export const explainedPaths = (pass: Pass): ReadonlySet<string> =>
  // PoC: o item de grid que passou da célula também já explica o estouro do grid.
  new Set(pass.overflows.filter((overflow) => isText(overflow) || isTable(overflow) || overflow.cell === true).map((overflow) => overflow.path));
