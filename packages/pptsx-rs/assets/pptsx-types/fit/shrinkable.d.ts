import type { PositionedNode, PositionedTable, PositionedText, Pt, ResolvedNode, ResolvedTable, ResolvedText, TextLayout } from '../core/types.ts';
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
export declare const isResolvedShrinkable: (node: ResolvedNode) => node is ResolvedShrinkable;
export declare const isPositionedShrinkable: (node: PositionedNode) => node is PositionedShrinkable;
/** Size atual na árvore resolvida (o patch do ajuste já aplicado). */
export declare const shrinkSizeOf: (node: ResolvedShrinkable) => Pt;
export declare const cellPaddingOf: (table: ResolvedTable) => Pt;
/** Largura em que as células da coluna quebram: a coluna menos a margem interna dos dois lados. */
export declare const cellWidthOf: (table: PositionedTable, column: number, span?: number) => Pt;
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
export declare const hasHeader: (table: ResolvedTable) => boolean;
/** Células achatadas que desenham (as cobertas por merge ficam de fora), com a origem de cada uma. */
export declare const tableCellsOf: (table: PositionedTable) => readonly TableCell[];
/** Alguma célula medida por estimativa (família/peso não registrados). */
export declare const isTableFontMissing: (table: PositionedTable) => boolean;
export declare const shrinkableOf: (node: PositionedShrinkable) => Shrinkable;
