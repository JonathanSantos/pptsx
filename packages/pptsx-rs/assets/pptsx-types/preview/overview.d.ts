import type { Dimensions } from '../core/types.ts';
export interface OverviewItem {
    readonly png: Buffer;
    readonly number: number;
    readonly badge?: 'error' | 'warning';
    /** M15: slide oculto: miniatura esmaecida e "oculto" na legenda. */
    readonly hidden?: boolean;
    /** M15: título da seção que começa neste slide (legenda e marca à esquerda). */
    readonly section?: string;
    /** M17: legenda própria (sem marca de seção), para overviews fora de um deck (catálogo de componentes). */
    readonly label?: string;
}
export interface OverviewOptions {
    readonly columns?: number;
    readonly thumbWidth?: number;
    /** Fontes para o número do slide; sem elas o número não aparece (sem fontes do sistema). */
    readonly fontFiles?: readonly string[];
}
/** IHDR vem logo após a assinatura de 8 bytes: width/height big-endian nos offsets 16 e 20. */
export declare const pngDimensionsOf: (png: Buffer) => Dimensions;
/** "3", "3 · Resultados", "4 · oculto". */
export declare const overviewLabelOf: (item: OverviewItem) => string;
export declare const overviewSvg: (items: readonly OverviewItem[], options?: OverviewOptions, family?: string) => string;
export declare const buildOverview: (items: readonly OverviewItem[], options?: OverviewOptions) => Buffer;
