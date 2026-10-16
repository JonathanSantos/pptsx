import type { PositionedIcon, PositionedTable, PositionedText, Pt, Rect, ResolvedCell, TextLayout } from '../core/types.ts';
/**
 * Geometria das células da Table (M14-3), comum ao emissor e ao preview: a área de cada célula
 * (com merges), o texto como um Text posicionado na área de conteúdo (padding, ícone e `valign`
 * aplicados) e o ícone como um Icon posicionado. Puro.
 */
export interface PlacedCell {
    readonly row: number;
    readonly col: number;
    readonly cell: ResolvedCell;
    /** Área da célula (as colunas e linhas que ela cobre). */
    readonly rect: Rect;
    readonly layout: TextLayout;
}
/** Posições acumuladas: offsets[i] = início da i-ésima faixa; o último = fim da tabela. */
export declare const offsetsOf: (start: Pt, sizes: readonly Pt[]) => readonly Pt[];
/** Células que desenham (as cobertas por merge ficam de fora), com a área mesclada. */
export declare const placedCellsOf: (table: PositionedTable) => readonly PlacedCell[];
/**
 * A célula como um Text posicionado: frame = área do texto (depois do ícone, com o `valign`
 * aplicado à altura do texto), props com a família/corpo/alinhamento da tabela e os runs da célula.
 */
export declare const cellTextOf: (table: PositionedTable, placed: PlacedCell) => PositionedText;
/** O ícone da célula como um Icon posicionado (no início da área interna, centrado na 1ª linha ou pelo valign). */
export declare const cellIconOf: (table: PositionedTable, placed: PlacedCell) => PositionedIcon | undefined;
