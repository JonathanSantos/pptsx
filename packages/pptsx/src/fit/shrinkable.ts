import { DEFAULTS, tableStyleOf, textStyleOf } from '../core/defaults.ts';
import type {
  PositionedNode,
  PositionedTable,
  PositionedText,
  Pt,
  ResolvedNode,
  ResolvedTable,
  ResolvedText,
  TextLayout,
} from '../core/types.ts';

// Text e Table encolhem pelas mesmas regras (escopo, busca binária, piso por palavra).
// A busca só enxerga esta visão comum; cada kind diz como preenchê-la.

export type ResolvedShrinkable = ResolvedText | ResolvedTable;
export type PositionedShrinkable = PositionedText | PositionedTable;

/** Trecho com palavra partida: o maior segmento indivisível e a largura de quebra em que ele não coube. */
export interface BrokenSegment {
  readonly widest: Pt;
  readonly breakWidth: Pt;
}

/** O que o shrink precisa saber de um nó posicionado que encolhe. */
export interface Shrinkable {
  readonly path: string;
  /** Size efetivo neste layout. */
  readonly fontSize: Pt;
  readonly fontMissing: boolean;
  /** Vazio = nenhuma palavra partida. Text: no máximo um; Table: um por célula partida. */
  readonly broken: readonly BrokenSegment[];
  /** Largura da linha mais longa: só conta no estouro de largura do nowrap (Table não tem). */
  readonly lineWidth: Pt;
}

export const isResolvedShrinkable = (node: ResolvedNode): node is ResolvedShrinkable =>
  node.kind === 'text' || node.kind === 'table';

export const isPositionedShrinkable = (node: PositionedNode): node is PositionedShrinkable =>
  node.kind === 'text' || node.kind === 'table';

/** Size atual na árvore resolvida (o patch do ajuste já aplicado). */
export const shrinkSizeOf = (node: ResolvedShrinkable): Pt =>
  node.kind === 'table' ? tableStyleOf(node.props).size : textStyleOf(node.props).size;

// O medidor quebra em disponível × textSafety; a regra de três do piso usa a mesma largura.
const breakWidthOf = (available: Pt): Pt => available * DEFAULTS.textSafety;

const textView = (text: PositionedText): Shrinkable => ({
  path: text.path,
  fontSize: text.text.fontSize,
  fontMissing: text.text.fontMissing,
  broken: text.text.wordBroken ? [{ widest: text.text.widestSegment, breakWidth: breakWidthOf(text.frame.width) }] : [],
  lineWidth: text.text.width,
});

export const cellPaddingOf = (table: ResolvedTable): Pt => table.props.cellPadding ?? DEFAULTS.table.cellPadding;

/** Largura em que as células da coluna quebram: a coluna menos a margem interna dos dois lados. */
export const cellWidthOf = (table: PositionedTable, column: number, span = 1): Pt =>
  Math.max(0, table.columnWidths.slice(column, column + span).reduce((sum, width) => sum + width, 0) - 2 * cellPaddingOf(table));

export interface TableCell {
  readonly layout: TextLayout;
  /** Linha em `cells` (o cabeçalho, quando há, é a 0). */
  readonly row: number;
  readonly column: number;
  /** Texto da célula como o autor escreveu (cabeçalho = `columns[c].header`). */
  readonly content: string;
  readonly isHeader: boolean;
  /** M14: colunas que a célula cobre. */
  readonly span: number;
}

export const hasHeader = (table: ResolvedTable): boolean => table.headerCount > 0;

/** Células achatadas que desenham (as cobertas por merge ficam de fora), com a origem de cada uma. */
export const tableCellsOf = (table: PositionedTable): readonly TableCell[] =>
  table.cells.flatMap((cells, row) =>
    cells.flatMap((layout, column) => {
      const cell = table.grid[row]?.[column];
      if (cell === undefined || cell.covered) return [];
      return [{ layout, row, column, span: cell.colSpan, content: cell.text, isHeader: cell.header }];
    }),
  );

/** Alguma célula medida por estimativa (família/peso não registrados). */
export const isTableFontMissing = (table: PositionedTable): boolean =>
  table.cells.some((row) => row.some((cell) => cell.fontMissing));

// A tabela encolhe como UMA unidade: qualquer célula partida conta, cada uma contra a largura da sua coluna.
const tableView = (table: PositionedTable): Shrinkable => {
  const cells = tableCellsOf(table);
  return {
    path: table.path,
    fontSize: table.fontSize,
    fontMissing: isTableFontMissing(table),
    broken: cells
      .filter((cell) => cell.layout.wordBroken)
      .map((cell) => ({ widest: cell.layout.widestSegment, breakWidth: breakWidthOf(cellWidthOf(table, cell.column, cell.span)) })),
    lineWidth: 0,
  };
};

export const shrinkableOf = (node: PositionedShrinkable): Shrinkable =>
  node.kind === 'table' ? tableView(node) : textView(node);
