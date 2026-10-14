// Colunas sem width seguem o conteúdo (min/max-content por coluna, como `table-layout: auto`
// do CSS 2.1 §17.5.2.2); `columnWidthsOf` continua sendo a divisão igual (fixas sem conteúdo).
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

/**
 * Altura emitida da linha: para cima no passo do Keynote (M10-H: ele só cresce a linha quando
 * falta espaço), para frame, fit, emissão e preview usarem a mesma. O ruído de ponto flutuante
 * logo acima de um múltiplo não pode somar um passo inteiro.
 */
const roundRowHeight = (height: Pt): Pt => {
  const step = DEFAULTS.table.rowHeightStep;
  return Math.ceil(height / step - DEFAULTS.css.layoutNoise) * step;
};

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
  // As células ficam com a medição crua; só a altura da linha é arredondada.
  const rowHeights = cells.map((row) => roundRowHeight(Math.max(0, ...row.map((cell) => cell.height)) + 2 * padding));
  return { columnWidths, rowHeights, cells, height: sum(rowHeights), width: sum(columnWidths) };
};

interface ContentWidths {
  /** Maior trecho indivisível da coluna + padding: abaixo disso a palavra quebra por caractere. */
  readonly min: Pt;
  /** Linha mais larga sem quebrar + padding. */
  readonly max: Pt;
}

/** min/max-content de cada coluna (cabeçalho incluído), medidos sem limite de largura. */
const contentWidthsOf = (specs: readonly TableRowSpec[], columns: number, padding: Pt, env: LayoutEnv): readonly ContentWidths[] => {
  const safety = env.textSafety ?? DEFAULTS.textSafety;
  const cells = measureCells(specs, Array.from({ length: columns }, () => Number.POSITIVE_INFINITY), env);
  return Array.from({ length: columns }, (_, index) => {
    const column = cells.map((row) => row[index]).filter((cell): cell is TextLayout => cell !== undefined);
    return {
      min: Math.max(0, ...column.map((cell) => cell.widestSegment / safety)) + 2 * padding,
      max: Math.max(0, ...column.map((cell) => cell.width)) + 2 * padding,
    };
  });
};

/**
 * Colunas auto pelo conteúdo. Com espaço para o max-content de todas, cada uma fica com o
 * seu e a sobra é repartida na proporção do max-content; sem espaço nem para o min-content, o
 * min-content escala para caber; entre os dois, interpola de min para max (CSS 2.1 §17.5.2.2).
 */
const autoWidthsOf = (content: readonly ContentWidths[], available: Pt): readonly Pt[] => {
  const minTotal = sum(content.map((c) => c.min));
  const maxTotal = sum(content.map((c) => c.max));
  if (!Number.isFinite(available)) return content.map((c) => c.max);
  if (maxTotal <= available) return content.map((c) => c.max + (maxTotal > 0 ? ((available - maxTotal) * c.max) / maxTotal : (available - maxTotal) / content.length));
  if (minTotal >= available) return content.map((c) => (minTotal > 0 ? (available * c.min) / minTotal : available / content.length));
  const ratio = (available - minTotal) / (maxTotal - minTotal);
  return content.map((c) => c.min + (c.max - c.min) * ratio);
};

/** Fixas em pt/% ficam; as auto dividem o resto pelo conteúdo. */
const contentColumnWidthsOf = (table: ResolvedTable, specs: readonly TableRowSpec[], tableWidth: Pt, padding: Pt, env: LayoutEnv): readonly Pt[] => {
  const { columns } = table.props;
  const fixed = columns.map((column) => fixedWidthOf(column, tableWidth));
  const free = fixed.map((width, index) => (width === undefined ? index : -1)).filter((index) => index >= 0);
  if (free.length === 0) return columnWidthsOf(columns, tableWidth);
  const content = contentWidthsOf(specs, columns.length, padding, env);
  const available = Number.isFinite(tableWidth) ? Math.max(0, tableWidth - sum(fixed.map((width) => width ?? 0))) : Number.POSITIVE_INFINITY;
  const autos = autoWidthsOf(free.map((index) => content[index]!), available);
  const widths = fixed.map((width, index) => width ?? autos[free.indexOf(index)] ?? 0);
  // Fixas que já passam da largura: escala tudo para fechar a soma.
  return Number.isFinite(tableWidth) && sum(widths) > tableWidth + 1e-6 ? scaleTo(widths, tableWidth) : widths;
};

/** Mede a tabela na largura dada (`Infinity` = largura natural pelo conteúdo). */
export const measureTable = (table: ResolvedTable, width: Pt, env: LayoutEnv): TableLayout => {
  const specs = rowSpecsOf(table);
  const padding = cellPaddingOf(table);
  const widths = contentColumnWidthsOf(table, specs, width, padding, env);
  const layout = layoutAt(specs, widths, padding, env);
  return Number.isFinite(width) ? { ...layout, width } : layout;
};
