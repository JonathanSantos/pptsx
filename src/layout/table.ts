// Colunas sem width seguem o conteúdo (min/max-content por coluna, como `table-layout: auto`
// do CSS 2.1 §17.5.2.2); `columnWidthsOf` continua sendo a divisão igual (fixas sem conteúdo).
import { DEFAULTS, tableStyleOf } from '../core/defaults.ts';
import type { LayoutEnv, Pt, ResolvedCell, ResolvedTable, TableColumn, TextLayout, TextRun } from '../core/types.ts';

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

/** M14: espaço entre o ícone da célula e o texto (pt). */
const iconGapOf = (cell: ResolvedCell): Pt => (cell.icon === undefined ? 0 : cell.icon.size + DEFAULTS.table.iconGap);

/** Largura que a célula ocupa: as colunas que ela cobre. */
const spanWidthOf = (widths: readonly Pt[], col: number, span: number): Pt => sum(widths.slice(col, col + span));

const EMPTY_RUNS: readonly TextRun[] = [];

const measureCell = (table: ResolvedTable, cell: ResolvedCell, maxWidth: Pt, env: LayoutEnv): TextLayout => {
  // O estilo base é o do 1º trecho (o cabeçalho é negrito): a linha usa as métricas dessa face.
  const base = tableStyleOf(table.props);
  const [first] = cell.runs;
  const style = first === undefined ? base : { ...base, weight: first.weight, italic: first.italic };
  const runs = cell.runs.length === 0 ? EMPTY_RUNS : cell.runs;
  // Célula com ícone fica numa linha (o espaço do ícone no PPTX só existe na 1ª linha).
  return env.measureText({
    content: cell.text,
    style,
    ...(runs.length === 0 ? {} : { runs }),
    maxWidth: Math.max(0, maxWidth - iconGapOf(cell)),
    ...(cell.icon === undefined ? {} : { nowrap: true }),
  });
};

/** Uma medição por posição da grade (cobertas: texto vazio, não contam para nada). */
const measureCells = (table: ResolvedTable, columnWidths: readonly Pt[], padding: Pt, env: LayoutEnv): readonly (readonly TextLayout[])[] =>
  table.grid.map((row) =>
    row.map((cell, col) => measureCell(table, cell, Math.max(0, spanWidthOf(columnWidths, col, cell.colSpan) - 2 * padding), env)),
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

/** Altura que a célula pede: o texto (ou o ícone, se maior) mais a margem dos dois lados. */
const cellHeightOf = (cell: ResolvedCell, layout: TextLayout, padding: Pt): Pt =>
  Math.max(layout.height, cell.icon?.size ?? 0) + 2 * padding;

/**
 * Linhas: primeiro as células de uma linha só; depois cada rowSpan que não coube reparte o que
 * falta igualmente pelas linhas que cobre (CSS 2.1 §17.5.3). Arredondamento no fim.
 */
const rowHeightsOf = (table: ResolvedTable, cells: readonly (readonly TextLayout[])[], padding: Pt): readonly Pt[] => {
  const single = table.grid.map((row, r) =>
    Math.max(0, ...row.flatMap((cell, c) => (cell.covered || cell.rowSpan > 1 ? [] : [cellHeightOf(cell, cells[r]![c]!, padding)]))),
  );
  const spanned = table.grid.reduce<readonly Pt[]>(
    (heights, row, r) =>
      row.reduce<readonly Pt[]>((acc, cell, c) => {
        if (cell.covered || cell.rowSpan <= 1) return acc;
        const covered = acc.slice(r, r + cell.rowSpan);
        const missing = cellHeightOf(cell, cells[r]![c]!, padding) - sum(covered);
        if (missing <= 0) return acc;
        return acc.map((height, index) => (index >= r && index < r + cell.rowSpan ? height + missing / cell.rowSpan : height));
      }, heights),
    single,
  );
  return spanned.map(roundRowHeight);
};

const layoutAt = (table: ResolvedTable, columnWidths: readonly Pt[], padding: Pt, env: LayoutEnv): TableLayout => {
  const cells = measureCells(table, columnWidths, padding, env);
  const rowHeights = rowHeightsOf(table, cells, padding);
  return { columnWidths, rowHeights, cells, height: sum(rowHeights), width: sum(columnWidths) };
};

interface ContentWidths {
  /** Maior trecho indivisível da coluna + padding: abaixo disso a palavra quebra por caractere. */
  readonly min: Pt;
  /** Linha mais larga sem quebrar + padding. */
  readonly max: Pt;
}

/**
 * min/max-content de cada coluna (cabeçalho incluído), medidos sem limite de largura. Só células de
 * uma coluna contam: a mesclada usa a largura que as colunas dela somarem (não as alarga).
 */
const contentWidthsOf = (table: ResolvedTable, columns: number, padding: Pt, env: LayoutEnv): readonly ContentWidths[] => {
  const safety = env.textSafety ?? DEFAULTS.textSafety;
  const singles = table.grid.flatMap((row) =>
    row.flatMap((cell, col) => (cell.covered || cell.colSpan > 1 ? [] : [{ col, cell, layout: measureCell(table, cell, Number.POSITIVE_INFINITY, env) }])),
  );
  return Array.from({ length: columns }, (_, index) => {
    const column = singles.filter((entry) => entry.col === index);
    return {
      min: Math.max(0, ...column.map((entry) => entry.layout.widestSegment / safety + iconGapOf(entry.cell))) + 2 * padding,
      max: Math.max(0, ...column.map((entry) => entry.layout.width + iconGapOf(entry.cell))) + 2 * padding,
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
const contentColumnWidthsOf = (table: ResolvedTable, tableWidth: Pt, padding: Pt, env: LayoutEnv): readonly Pt[] => {
  const { columns } = table.props;
  const fixed = columns.map((column) => fixedWidthOf(column, tableWidth));
  const free = fixed.map((width, index) => (width === undefined ? index : -1)).filter((index) => index >= 0);
  if (free.length === 0) return columnWidthsOf(columns, tableWidth);
  const content = contentWidthsOf(table, columns.length, padding, env);
  const available = Number.isFinite(tableWidth) ? Math.max(0, tableWidth - sum(fixed.map((width) => width ?? 0))) : Number.POSITIVE_INFINITY;
  const autos = autoWidthsOf(free.map((index) => content[index]!), available);
  const widths = fixed.map((width, index) => width ?? autos[free.indexOf(index)] ?? 0);
  // Fixas que já passam da largura: escala tudo para fechar a soma.
  return Number.isFinite(tableWidth) && sum(widths) > tableWidth + 1e-6 ? scaleTo(widths, tableWidth) : widths;
};

/** Mede a tabela na largura dada (`Infinity` = largura natural pelo conteúdo). */
export const measureTable = (table: ResolvedTable, width: Pt, env: LayoutEnv): TableLayout => {
  const padding = cellPaddingOf(table);
  const widths = contentColumnWidthsOf(table, width, padding, env);
  const layout = layoutAt(table, widths, padding, env);
  return Number.isFinite(width) ? { ...layout, width } : layout;
};

/** Largura natural de um espaço na face da tabela: "x x" − "xx" (o medidor apara espaço no fim da linha). */
export const spaceWidthOf = (table: ResolvedTable, env: LayoutEnv): Pt => {
  const style = tableStyleOf(table.props);
  const width = (content: string) => env.measureText({ content, style, maxWidth: Number.POSITIVE_INFINITY, nowrap: true }).width;
  return Math.max(0, width('x x') - width('xx')) * (env.textSafety ?? DEFAULTS.textSafety);
};
