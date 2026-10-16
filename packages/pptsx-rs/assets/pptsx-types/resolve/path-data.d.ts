import type { PathCommand, Rect } from '../core/types.ts';
/**
 * `d` do SVG → comandos normalizados (M12-3): absolutos, só M/L/C/Q/Z. H/V viram L, S/T refletem o
 * controle anterior, A vira até 4 cúbicas (uma por quarto de volta). Puro. Erro de sintaxe ou
 * comando fora do subconjunto → `{ problem }` (o fit emite path-invalid).
 */
export type ParsedPath = {
    readonly commands: readonly PathCommand[];
} | {
    readonly problem: string;
};
/** Arco elíptico (parametrização por extremos) → cúbicas, uma por trecho de até 90°. */
export declare const arcToCubics: (from: readonly [number, number], radii: readonly [number, number], rotationDegrees: number, largeArc: boolean, sweep: boolean, to: readonly [number, number]) => readonly PathCommand[];
export declare const parsePathData: (d: string) => ParsedPath;
/** Caixa envolvente exata dos comandos (curvas pelos extremos, não pelos controles). */
export declare const boundsOf: (commands: readonly PathCommand[]) => Rect;
