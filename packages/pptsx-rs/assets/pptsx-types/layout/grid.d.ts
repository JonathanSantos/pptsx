import type { GridPlacement, Rect } from '../core/types.ts';
/**
 * Motor de grid puro: subconjunto do CSS Grid Level 1 (§7 tracks, §8 placement, §11 track
 * sizing). Não sabe nada de Yoga nem de texto: o tamanho de cada item chega por callbacks
 * (`GridItemInput`). Fora do escopo: áreas nomeadas, subgrid, auto-fill/auto-fit, dense,
 * baseline e justify/align-content (a grade fica no início do contêiner).
 */
export type Breadth = {
    readonly kind: 'fixed';
    readonly value: number;
} | {
    readonly kind: 'percent';
    readonly value: number;
} | {
    readonly kind: 'auto';
} | {
    readonly kind: 'min-content';
} | {
    readonly kind: 'max-content';
} | {
    readonly kind: 'fr';
    readonly value: number;
};
export interface TrackSize {
    readonly min: Breadth;
    readonly max: Breadth;
}
/** Lista de tracks (`gridTemplateColumns`); undefined = sintaxe fora do subconjunto. */
export declare const parseTrackList: (text: string | undefined) => readonly TrackSize[] | undefined;
/** `gridAutoRows`: um track (ou lista, repetida em ciclo). */
export declare const parseAutoTracks: (text: string | undefined) => readonly TrackSize[];
export interface Area {
    /** Linhas 0-based: a área ocupa [rowStart, rowEnd) × [columnStart, columnEnd). */
    readonly rowStart: number;
    readonly rowEnd: number;
    readonly columnStart: number;
    readonly columnEnd: number;
}
export interface PlacementInput {
    readonly column: GridPlacement;
    readonly row: GridPlacement;
}
export interface Placed {
    readonly areas: readonly Area[];
    readonly columns: number;
    readonly rows: number;
}
/**
 * Placement (CSS Grid §8.5, fluxo `row`, sem `dense`): 1) itens com linha e coluna definidas;
 * 2) itens com linha definida, na 1ª coluna livre daquela linha; 3) o resto pelo cursor, que
 * só avança (sparse). O número de colunas é o explícito ou o que os itens exigirem.
 */
export declare const placeItems: (items: readonly PlacementInput[], explicitColumns: number, explicitRows: number) => Placed;
/** Contribuições de um item num eixo (já com margens). */
export interface Contribution {
    readonly min: number;
    readonly max: number;
}
export interface SizingItem {
    readonly start: number;
    readonly end: number;
    readonly contribution: Contribution;
}
/**
 * Tamanhos dos tracks de um eixo. `available` = tamanho de conteúdo definido do contêiner
 * nesse eixo (undefined = indefinido: a grade fica com o tamanho do conteúdo).
 */
export declare const sizeTracks: (sizes: readonly TrackSize[], items: readonly SizingItem[], available: number | undefined, gap: number) => readonly number[];
/** Tracks explícitos + implícitos (gridAutoRows/Columns em ciclo) até `count`. */
export declare const tracksFor: (explicit: readonly TrackSize[], auto: readonly TrackSize[], count: number) => readonly TrackSize[];
/** Posições (início) de cada track a partir de 0. */
export declare const offsetsOf: (sizes: readonly number[], gap: number) => readonly number[];
/** Retângulo de uma área (relativo à origem da área de conteúdo). */
export declare const areaRect: (area: Area, columns: readonly number[], rows: readonly number[], columnGap: number, rowGap: number) => Rect;
export declare const totalOf: (sizes: readonly number[], gap: number) => number;
