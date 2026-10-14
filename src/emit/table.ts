import type * as Pptx from './pptx.ts';
import { DEFAULTS, PT_PER_INCH, tableHeaderOf, tableStyleOf } from '../core/defaults.ts';
import type { Color, LineBreaks, PositionedTable, TableHeaderStyle, TextLayout } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { collapseSpaces, hexOf } from './runs.ts';

/**
 * Table → `slide.addTable(rows, options)` (M10-D). Funções puras; unidades e
 * armadilhas do pptxgenjs 4.0.1 vêm do spike (docs/work/reports/M10-spike.md).
 */

export interface TableSpec {
  readonly rows: Pptx.TableRow[];
  readonly options: Pptx.TableProps;
}

/** O que da emissão importa para a tabela (EmitContext satisfaz). */
export interface TableEmitContext {
  readonly lang?: string;
  readonly lineBreaks?: LineBreaks;
}

/**
 * O Keynote só cresce a linha quando falta espaço e trunca o passo de linha
 * (16,1 → 16,0); arredondar para cima ao meio ponto dá folga sem mexer no layout.
 */
const ROW_HEIGHT_STEP_PT = 0.5;
/** Evita que 28 + ruído de ponto flutuante suba para 28,5. */
const ROUNDING_EPSILON = 1e-9;

/** Erro de emissão: a árvore é válida, mas o PPTX não consegue representá-la. */
export class EmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmitError';
  }
}

export const roundRowHeight = (height: number): number =>
  Math.ceil(height / ROW_HEIGHT_STEP_PT - ROUNDING_EPSILON) * ROW_HEIGHT_STEP_PT;

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/**
 * Margem sempre em polegadas: o pptxgenjs lê o array inteiro em pt quando o 1º
 * elemento é ≥ 1, então um padding de 72 pt ou mais mudaria de unidade sem aviso.
 */
export const cellMarginOf = (node: PositionedTable): [number, number, number, number] => {
  const padding = node.props.cellPadding ?? DEFAULTS.table.cellPadding;
  if (padding >= PT_PER_INCH) {
    throw new EmitError(
      `<Table> em "${node.path}": cellPadding ${padding} pt não é suportado no PPTX (precisa ser menor que ${PT_PER_INCH} pt).`,
    );
  }
  const inches = ptToInches(padding);
  return [inches, inches, inches, inches];
};

const borderOf = (border: Color | undefined): Pptx.BorderProps =>
  border === undefined ? { type: 'none' } : { type: 'solid', pt: DEFAULTS.table.borderWidth, color: hexOf(border) };

// ───────────── texto da célula ─────────────

/** Uma run por linha calculada; breakLine fecha o <a:p> de cada linha menos a última. */
const runsOfLines = (lines: readonly string[]): Pptx.TableCell[] => {
  const nonEmpty = lines.length === 0 ? [''] : lines;
  return nonEmpty.map((text, index) => ({
    text,
    options: index < nonEmpty.length - 1 ? { breakLine: true } : {},
  }));
};

/** 'auto': o texto do autor, um run por parágrafo ('\n'), espaços normalizados como no medidor. */
const authorRunsOf = (text: string): Pptx.TableCell[] => runsOfLines(text.split('\n').map(collapseSpaces));

/** Textos originais na mesma grade de `cells` (cabeçalho na linha 0 quando há). */
const sourceRowsOf = (node: PositionedTable): readonly (readonly string[])[] =>
  tableHeaderOf(node.props) === undefined ? node.rows : [node.props.columns.map((c) => c.header), ...node.rows];

const cellRunsOf = (layout: TextLayout, source: string | undefined, lineBreaks: LineBreaks): Pptx.TableCell[] =>
  lineBreaks === 'auto' ? authorRunsOf(source ?? layout.lines.join(' ')) : runsOfLines(layout.lines);

// ───────────── estilo da célula ─────────────

interface RowStyle {
  readonly bold: boolean;
  readonly fill?: Color;
  readonly color?: Color;
}

const headerStyleOf = (header: TableHeaderStyle): RowStyle => ({
  bold: (header.weight ?? DEFAULTS.table.header.weight) === 'bold',
  fill: header.fill,
  color: header.color,
});

/** Zebra nas linhas de dados de índice ímpar (2ª, 4ª…), contadas sem o cabeçalho. */
const dataStyleOf = (dataIndex: number, stripe: Color | undefined): RowStyle => ({
  bold: false,
  fill: dataIndex % 2 === 1 ? stripe : undefined,
});

const rowStyleOf = (node: PositionedTable, rowIndex: number): RowStyle => {
  const header = tableHeaderOf(node.props);
  if (header === undefined) return dataStyleOf(rowIndex, node.props.stripe);
  if (rowIndex === 0) return headerStyleOf(header);
  return dataStyleOf(rowIndex - 1, node.props.stripe);
};

const cellOptionsOf = (node: PositionedTable, style: RowStyle, columnIndex: number, lang: string): Pptx.TableCellProps => ({
  align: node.props.columns[columnIndex]?.align ?? DEFAULTS.text.align,
  valign: 'top',
  bold: style.bold,
  // lang não está entre as opções que o pptxgenjs copia da tabela para a célula.
  lang,
  ...(style.fill === undefined ? {} : { fill: { color: hexOf(style.fill) } }),
  ...(style.color === undefined ? {} : { color: hexOf(style.color) }),
});

export const tableRowsOf = (node: PositionedTable, ctx: TableEmitContext = {}): Pptx.TableRow[] => {
  const lineBreaks = ctx.lineBreaks ?? DEFAULTS.lineBreaks;
  const lang = ctx.lang ?? DEFAULTS.lang;
  const sources = sourceRowsOf(node);
  return node.cells.map((row, rowIndex) => {
    const style = rowStyleOf(node, rowIndex);
    return row.map((layout, columnIndex) => ({
      text: cellRunsOf(layout, sources[rowIndex]?.[columnIndex], lineBreaks),
      options: cellOptionsOf(node, style, columnIndex, lang),
    }));
  });
};

export const tableOptionsOf = (node: PositionedTable, ctx: TableEmitContext = {}): Pptx.TableProps => {
  const rowHeights = node.rowHeights.map(roundRowHeight);
  return {
    x: ptToInches(node.frame.x),
    y: ptToInches(node.frame.y),
    // w/h explícitos: sem eles o <p:xfrm> sai 7,5 × 1 in, sem relação com a tabela.
    w: ptToInches(sum(node.columnWidths)),
    h: ptToInches(sum(rowHeights)),
    colW: node.columnWidths.map(ptToInches),
    rowH: rowHeights.map(ptToInches),
    margin: cellMarginOf(node),
    fontFace: tableStyleOf(node.props).family,
    fontSize: node.fontSize,
    color: hexOf(node.props.color ?? DEFAULTS.text.color),
    border: borderOf(node.props.border),
    valign: 'top',
    autoPage: false,
    lang: ctx.lang ?? DEFAULTS.lang,
  };
};

export const tableOf = (node: PositionedTable, ctx: TableEmitContext = {}): TableSpec => ({
  rows: tableRowsOf(node, ctx),
  options: tableOptionsOf(node, ctx),
});
