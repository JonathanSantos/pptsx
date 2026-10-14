import { DEFAULTS, tableHeaderOf, tableStyleOf } from '../core/defaults.ts';
import type { LayoutEnv, Pt, ResolvedTable, TableColumn, TextLayout, TextStyle } from '../core/types.ts';

/** Medição da tabela numa largura: tudo que o read e o fit precisam (ver CONTRACTS §M10-B). */
export interface TableLayout {
  readonly columnWidths: readonly Pt[];
  readonly rowHeights: readonly Pt[];
  readonly cells: readonly (readonly TextLayout[])[];
  readonly height: Pt;
  readonly width: Pt;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const PERCENT_BASE = 100;

/** Largura própria da coluna; undefined = livre (sem width, ou `%` sem base finita). */
const fixedWidthOf = (column: TableColumn, tableWidth: Pt): Pt | undefined => {
  const { width } = column;
  if (width === undefined) return undefined;
  if (typeof width === 'number') return width;
  if (!Number.isFinite(tableWidth)) return undefined;
  return (Number.parseFloat(width) / PERCENT_BASE) * tableWidth;
};

/** Fecha a soma em `tableWidth`; soma nula não tem proporção, então divide igualmente. */
const scaleTo = (widths: readonly Pt[], tableWidth: Pt): readonly Pt[] => {
  const total = sum(widths);
  if (total <= 0) return widths.map(() => tableWidth / widths.length);
  return widths.map((width) => (width * tableWidth) / total);
};

/**
 * Colunas em pt/% ficam fixas; as livres dividem igualmente o que sobra. Sem livre (ou
 * com as fixas passando da largura, quando as livres ficam com 0) escala tudo para a
 * soma fechar `tableWidth`. Largura não finita: não há o que dividir, livres e `%` dão 0
 * (a largura natural depende das células: é o `measureTable` que a calcula).
 */
export const columnWidthsOf = (columns: readonly TableColumn[], tableWidth: Pt): readonly Pt[] => {
  const fixed = columns.map((column) => fixedWidthOf(column, tableWidth));
  if (!Number.isFinite(tableWidth)) return fixed.map((width) => width ?? 0);
  const used = sum(fixed.map((width) => width ?? 0));
  const freeCount = fixed.filter((width) => width === undefined).length;
  const share = freeCount > 0 ? Math.max(0, tableWidth - used) / freeCount : 0;
  const widths = fixed.map((width) => width ?? share);
  if (freeCount > 0 && used <= tableWidth) return widths;
  return scaleTo(widths, tableWidth);
};

const cellPaddingOf = (table: ResolvedTable): Pt => table.props.cellPadding ?? DEFAULTS.table.cellPadding;

interface TableRowSpec {
  readonly texts: readonly string[];
  readonly style: TextStyle;
}

/** Linhas na ordem de desenho: cabeçalho (quando há) na linha 0, depois os dados. */
const rowSpecsOf = (table: ResolvedTable): readonly TableRowSpec[] => {
  const style = tableStyleOf(table.props);
  const data = table.rows.map((texts) => ({ texts, style }));
  const header = tableHeaderOf(table.props);
  if (header === undefined) return data;
  const weight = header.weight ?? DEFAULTS.table.header.weight ?? style.weight;
  return [{ texts: table.props.columns.map((column) => column.header), style: { ...style, weight } }, ...data];
};

const measureCells = (
  specs: readonly TableRowSpec[],
  maxWidths: readonly Pt[],
  env: LayoutEnv,
): readonly (readonly TextLayout[])[] =>
  specs.map(({ texts, style }) =>
    texts.map((content, column) => env.measureText({ content, style, maxWidth: maxWidths[column] ?? 0 })),
  );

const layoutAt = (
  specs: readonly TableRowSpec[],
  columnWidths: readonly Pt[],
  padding: Pt,
  env: LayoutEnv,
): TableLayout => {
  const cells = measureCells(
    specs,
    columnWidths.map((width) => Math.max(0, width - 2 * padding)),
    env,
  );
  const rowHeights = cells.map((row) => Math.max(0, ...row.map((cell) => cell.height)) + 2 * padding);
  return { columnWidths, rowHeights, cells, height: sum(rowHeights), width: sum(columnWidths) };
};

/**
 * Sem limite: coluna em pt fica com o valor; as livres (e `%`, sem base) ficam todas com
 * a célula livre mais larga + padding dos dois lados. Iguais, e não cada uma com a sua,
 * porque numa largura finita as livres dividem igualmente: o read remede com frame.width
 * e, com larguras diferentes aqui, a coluna mais larga ficaria estreita e quebraria.
 * Assim medir de novo na largura natural devolve as mesmas colunas.
 */
const naturalColumnWidthsOf = (table: ResolvedTable, specs: readonly TableRowSpec[], padding: Pt, env: LayoutEnv) => {
  const { columns } = table.props;
  const fixed = columns.map((column) => fixedWidthOf(column, Number.POSITIVE_INFINITY));
  const unbounded = measureCells(
    specs,
    columns.map(() => Number.POSITIVE_INFINITY),
    env,
  );
  const freeCells = unbounded.flatMap((row) => row.filter((_cell, index) => fixed[index] === undefined));
  const free = Math.max(0, ...freeCells.map((cell) => cell.width)) + 2 * padding;
  return fixed.map((width) => width ?? free);
};

/** Mede a tabela na largura dada (`Infinity` = largura natural pelo conteúdo). */
export const measureTable = (table: ResolvedTable, width: Pt, env: LayoutEnv): TableLayout => {
  const specs = rowSpecsOf(table);
  const padding = cellPaddingOf(table);
  if (Number.isFinite(width)) {
    return { ...layoutAt(specs, columnWidthsOf(table.props.columns, width), padding, env), width };
  }
  // As células são remedidas nas larguras naturais: uma coluna em pt mais estreita que o conteúdo quebra.
  return layoutAt(specs, naturalColumnWidthsOf(table, specs, padding, env), padding, env);
};
