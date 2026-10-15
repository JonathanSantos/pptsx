import { DEFAULTS, tableFitOf, tableStyleOf } from '../core/defaults.ts';
import type { Diagnostic, PositionedTable, Pt, TableFitPolicy, TextStyle } from '../core/types.ts';
import { brokenWordsOf } from '../text/index.ts';
import type { Overflow } from './detect.ts';
import {
  fontMissing,
  tableIllegible,
  tableOverflowKept,
  tableOverflowShrunk,
  tableCellIcon,
  tableShrunk,
  tableWordBroken,
} from './diagnostics.ts';
import type { BrokenColumn, DiagnosticContext, TableRows } from './diagnostics.ts';
import type { ShrinkPlan } from './pass.ts';
import { cellWidthOf, tableCellsOf } from './shrinkable.ts';
import type { TableCell } from './shrinkable.ts';

// Diagnósticos finais da Table: mesma ideia do Text (shrink coube / não coube / ilegível /
// palavra partida / fonte ausente), mas a tabela é uma unidade e fala em linhas e colunas.

interface TableOutcome {
  readonly table: PositionedTable;
  readonly overflow: Overflow | undefined;
  readonly from: Pt;
  readonly to: Pt;
  readonly min: Pt;
  readonly rows: TableRows;
}

/**
 * Linhas de dados cujo fundo fica dentro da altura disponível (a medida menos o estouro,
 * o mesmo corte da detecção). O cabeçalho ocupa altura mas não conta como linha mostrada.
 */
const shownRowsOf = (table: PositionedTable, available: Pt): number => {
  const bottoms = table.rowHeights.reduce<readonly Pt[]>((acc, height) => [...acc, (acc.at(-1) ?? 0) + height], []);
  // M14: a linha só conta se as células mescladas que começam nela também cabem inteiras.
  const reach = table.grid.map((row, r) => Math.max(r, ...row.map((cell) => (cell.covered ? r : r + cell.rowSpan - 1))));
  return bottoms
    .slice(table.headerCount)
    .filter((_, index) => (bottoms[reach[index + table.headerCount] ?? index] ?? Infinity) <= available + DEFAULTS.fit.epsilon).length;
};

const rowsOf = (table: PositionedTable, overflow: Overflow | undefined): TableRows => {
  const total = table.rows.length;
  return overflow === undefined ? { shown: total, total } : { shown: shownRowsOf(table, table.height - overflow.overflowPt), total };
};

// Só o que o ajuste reduziu: size do autor já abaixo do piso é escolha dele.
const isIllegible = (outcome: TableOutcome): boolean =>
  outcome.to < outcome.from && outcome.to < DEFAULTS.text.minLegibleSize;

type Diagnose = (outcome: TableOutcome, ctx: DiagnosticContext) => readonly Diagnostic[];

// text-shrunk diz que coube: com estouro, não coube.
const overflowOrShrunk: Diagnose = (outcome, ctx) => {
  if (outcome.overflow !== undefined) return [tableOverflowShrunk(ctx, outcome.overflow, outcome, outcome.rows)];
  return outcome.to < outcome.from ? [tableShrunk(ctx, outcome.table.path, outcome.from, outcome.to)] : [];
};

const diagnoseShrink: Diagnose = (outcome, ctx) => [
  ...overflowOrShrunk(outcome, ctx),
  ...(isIllegible(outcome) ? [tableIllegible(ctx, outcome.table.path, outcome.from, outcome.to)] : []),
];

const diagnoseError: Diagnose = (outcome, ctx) =>
  outcome.overflow === undefined ? [] : [tableOverflowKept(ctx, outcome.overflow, outcome.to, outcome.rows)];

const DIAGNOSE: Readonly<Record<TableFitPolicy, Diagnose>> = { shrink: diagnoseShrink, error: diagnoseError };

/** Palavras partidas agrupadas por coluna, na ordem das colunas (sem repetir palavra). */
const brokenColumnsOf = (table: PositionedTable, cells: readonly TableCell[]): readonly BrokenColumn[] =>
  table.props.columns.flatMap((column, index) => {
    const words = cells
      .filter((cell) => cell.column === index && cell.span === 1 && cell.layout.wordBroken)
      .flatMap((cell) => brokenWordsOf(cell.content, cell.layout.paragraphs));
    const unique = [...new Set(words)];
    return unique.length === 0 ? [] : [{ header: column.header, words: unique, width: cellWidthOf(table, index) }];
  });

const wordBrokenDiagnostics = (outcome: TableOutcome, cells: readonly TableCell[], ctx: DiagnosticContext): readonly Diagnostic[] => {
  const columns = brokenColumnsOf(outcome.table, cells);
  return columns.length === 0 ? [] : [tableWordBroken(ctx, outcome.table.path, { columns, from: outcome.from, to: outcome.to })];
};

/** Face da primeira célula sem fonte: o cabeçalho pode pedir um peso que o corpo não pede. */
const missingStyleOf = (table: PositionedTable, cell: TableCell): TextStyle => {
  const style = tableStyleOf(table.props);
  const run = table.grid[cell.row]?.[cell.column]?.runs[0];
  return run === undefined ? style : { ...style, weight: run.weight, italic: run.italic };
};

/** M14: um aviso por tabela com ícone em célula. */
const cellIconNotice = (table: PositionedTable, ctx: DiagnosticContext): readonly Diagnostic[] =>
  table.grid.some((row) => row.some((cell) => cell.icon !== undefined)) ? [tableCellIcon(ctx, table.path)] : [];

// Fonte ausente: a medição é estimada, então estouro, shrink e palavra partida seriam ruído.
export const tableDiagnostics = (
  table: PositionedTable,
  plan: ShrinkPlan,
  overflow: Overflow | undefined,
  ctx: DiagnosticContext,
): readonly Diagnostic[] => {
  const cells = tableCellsOf(table);
  const missing = cells.find((cell) => cell.layout.fontMissing);
  if (missing !== undefined) return [fontMissing(ctx, table.path, missingStyleOf(table, missing))];
  const outcome: TableOutcome = {
    table,
    overflow,
    from: plan.from,
    to: table.fontSize,
    min: plan.min,
    rows: rowsOf(table, overflow),
  };
  return [...DIAGNOSE[tableFitOf(table.props)](outcome, ctx), ...wordBrokenDiagnostics(outcome, cells, ctx), ...cellIconNotice(table, ctx)];
};
