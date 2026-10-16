import type { LineRun, Pt, TextMeasureInput } from '../core/types.ts';
import { type MeasureRun } from './pieces.ts';
/** Largura de um trecho de texto em pt (um run só). */
export type MeasureWidth = (text: string) => Pt;
/** Linhas de cada parágrafo do autor; `flat()` dá todas as linhas. */
export type Paragraphs = readonly (readonly string[])[];
export declare const ELLIPSIS = "\u2026";
export interface LaidOutText {
    readonly paragraphs: Paragraphs;
    readonly lines: readonly string[];
    readonly lineRuns: readonly (readonly LineRun[])[];
    readonly truncated: boolean;
    /** Largura natural da linha mais longa, sem espaço final (sem folga de safety). */
    readonly widestLine: Pt;
    /** Maior trecho indivisível antes de quebra por caractere e corte; com nowrap, o parágrafo inteiro. */
    readonly widestSegment: Pt;
}
/**
 * Quebra (ou não, com nowrap) o conteúdo em `breakWidth` e corta em `maxLines`.
 * `measure` mede um texto de um run; a largura de um trecho é a soma dos seus runs.
 */
export declare const layoutText: (input: TextMeasureInput, breakWidth: Pt, measure: MeasureRun) => LaidOutText;
/** Quebra gulosa de um único parágrafo (sem '\n') num run só. Parágrafo vazio = uma linha vazia. */
export declare const breakLines: (paragraph: string, maxWidth: Pt, measureWidth: MeasureWidth) => readonly string[];
