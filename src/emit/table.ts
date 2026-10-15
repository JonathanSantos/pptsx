import type * as Pptx from './pptx.ts';
import { DEFAULTS, PT_PER_INCH, tableStyleOf } from '../core/defaults.ts';
import type { Color, LineBreaks, PositionedTable, PositionedText, TextLayout } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { hexOf, textRunsOfNode } from './runs.ts';
import { cellTextOf, placedCellsOf, type PlacedCell } from './table-cells.ts';

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

/** Erro de emissão: a árvore é válida, mas o PPTX não consegue representá-la. */
export class EmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmitError';
  }
}

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

// ───────────── células (M14-3) ─────────────

/**
 * Runs da célula pelo mesmo caminho do Text (estilo por trecho, face, sobrescrito, links), com
 * cada linha num <a:p> próprio (breakLine), como a tabela sempre saiu: a quebra suave do Text
 * (softBreakBefore) vira o fim do parágrafo anterior.
 */
const cellRunsOf = (text: PositionedText, lineBreaks: LineBreaks): Pptx.TableCell[] => {
  const runs = textRunsOfNode(text, lineBreaks);
  return runs.map((run, index) => {
    const next = runs[index + 1];
    const { softBreakBefore: _soft, breakLine, ...options } = run.options ?? {};
    const closes = breakLine === true || next?.options?.softBreakBefore === true;
    return { text: run.text, options: closes ? { ...options, breakLine: true } : options };
  }) as Pptx.TableCell[];
};

/** O .d.ts não lista lineSpacing na célula, mas o pptxgenjs passa as opções da célula aos runs (genXmlTextBody). */
type CellLineSpacing = Pick<Pptx.TextPropsOptions, 'lineSpacing'>;

/**
 * M11: `lineHeight` numérico (CSS, múltiplo do size) sai como `spcPts` exato = passo de linha
 * do layout da célula, como no Text. Com 'normal' a célula continua sem lnSpc: o Keynote bate
 * em ±0,25 pt com a altura natural (M10-spike).
 */
const cellLineSpacingOf = (node: PositionedTable, layout: TextLayout): CellLineSpacing =>
  tableStyleOf(node.props).lineHeight === 'normal' ? {} : { lineSpacing: layout.lineHeight };

const cellOptionsOf = (node: PositionedTable, placed: PlacedCell, lang: string): Pptx.TableCellProps & CellLineSpacing => ({
  align: placed.cell.align,
  valign: placed.cell.valign,
  // lang não está entre as opções que o pptxgenjs copia da tabela para a célula.
  lang,
  ...cellLineSpacingOf(node, placed.layout),
  ...(placed.cell.colSpan > 1 ? { colspan: placed.cell.colSpan } : {}),
  ...(placed.cell.rowSpan > 1 ? { rowspan: placed.cell.rowSpan } : {}),
  ...(placed.cell.fill === undefined ? {} : { fill: { color: hexOf(placed.cell.fill) } }),
});

/**
 * Célula com ícone: o Keynote ignora margem por célula e recuo de parágrafo, então o espaço do ícone
 * sai como um espaço inicial com `charSpacing` (largura do espaço + espaçamento = ícone + intervalo).
 */
const iconSpacerOf = (node: PositionedTable, placed: PlacedCell): Pptx.TableCell[] => {
  const icon = placed.cell.icon;
  if (icon === undefined) return [];
  const spacing = icon.size + DEFAULTS.table.iconGap - (node.spaceWidth ?? 0);
  // charSpacing é opção de run de texto; o pptxgenjs passa as opções do run da célula ao <a:rPr>.
  return [{ text: ' ', options: { charSpacing: Math.max(0, spacing) } as Pptx.TableCellProps }];
};

/** Linhas do pptxgenjs: cada célula que desenha, na ordem da grade (as cobertas por merge somem). */
export const tableRowsOf = (node: PositionedTable, ctx: TableEmitContext = {}): Pptx.TableRow[] => {
  const lineBreaks = ctx.lineBreaks ?? DEFAULTS.lineBreaks;
  const lang = ctx.lang ?? DEFAULTS.lang;
  const placed = placedCellsOf(node);
  return node.grid.map((_, row) =>
    placed
      .filter((cell) => cell.row === row)
      .map((cell) => ({ text: [...iconSpacerOf(node, cell), ...cellRunsOf(cellTextOf(node, cell), lineBreaks)], options: cellOptionsOf(node, cell, lang) })),
  );
};

export const tableOptionsOf = (node: PositionedTable, ctx: TableEmitContext = {}): Pptx.TableProps => {
  // M11: o layout já arredonda as linhas para cima ao passo do Keynote (DEFAULTS.table.rowHeightStep).
  const { rowHeights } = node;
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
