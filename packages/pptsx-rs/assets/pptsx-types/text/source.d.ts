import type { TextMeasureInput, TextRun } from '../core/types.ts';
import type { Pieces } from './pieces.ts';
/** Intervalo [start, end) de um parágrafo que pertence ao run `run`. */
interface Span {
    readonly start: number;
    readonly end: number;
    readonly run: number;
}
/** Um parágrafo do autor (sem '\n') com o run de cada trecho. */
export interface Source {
    readonly text: string;
    readonly spans: readonly Span[];
    /** Run de uma linha sem caracteres (parágrafo vazio, reticência sozinha). */
    readonly run: number;
}
/**
 * Trecho indivisível na quebra gulosa. `glue` é o que o separa do trecho anterior
 * quando os dois ficam na mesma linha: um espaço (com o run do espaço original)
 * entre palavras, nada depois de '-' ou '/' (o caractere já está no trecho anterior).
 */
export interface Segment {
    readonly pieces: Pieces;
    readonly glue: Pieces;
}
/**
 * Runs efetivos da medição: sem runs (ou sem nenhum, com conteúdo vazio) vale um run
 * com o estilo base. Runs que não somam o conteúdo são erro de quem chamou: medir
 * assim daria linhas que o emissor não consegue reconstruir.
 */
export declare const runsOfInput: (input: TextMeasureInput) => readonly TextRun[];
/** Parágrafos por '\n', cada um com seus trechos por run (offsets relativos ao parágrafo). */
export declare const sourcesOf: (content: string, runs: readonly TextRun[]) => readonly Source[];
/** Pedaços por run do intervalo [start, end) do parágrafo. */
export declare const piecesOf: (source: Source, start: number, end: number) => Pieces;
/** Palavras separadas por espaço (exceto NBSP), cada uma dividida depois de '-' e '/'. */
export declare const segmentsOf: (source: Source) => readonly Segment[];
export {};
