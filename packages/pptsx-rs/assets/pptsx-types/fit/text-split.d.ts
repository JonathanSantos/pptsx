import type { ResolvedText, TextRun } from '../core/types.ts';
/** Deslocamento em `content` logo depois das `count` primeiras linhas. */
export declare const offsetAfterLines: (content: string, lines: readonly string[], count: number) => number;
interface SplitRuns {
    readonly head: readonly TextRun[];
    readonly tail: readonly TextRun[];
}
/** Runs divididos no deslocamento; o espaço (e o '\n') da fronteira some dos dois lados. */
export declare const splitRunsAt: (runs: readonly TextRun[], offset: number) => SplitRuns;
/** O mesmo Text só com estes runs (path, props e css intactos). */
export declare const withRuns: (text: ResolvedText, runs: readonly TextRun[]) => ResolvedText;
/**
 * Onde cortar, dado que `fitting` linhas cabem: no fim de parágrafo mais próximo abaixo, se a parte
 * não ficar com menos da metade de `fitting`; senão dentro do parágrafo, com pelo menos
 * `orphanLines` linhas dele em cada lado (recuando para o início do parágrafo se não der).
 * Nunca menos de 1 linha.
 */
export declare const cutLineOf: (paragraphs: readonly (readonly string[])[], fitting: number) => number;
export {};
