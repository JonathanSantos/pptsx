import type { LineRun, Pt } from '../core/types.ts';
/**
 * Trecho de texto dividido por run, na ordem. Invariantes: nenhum pedaço vazio e
 * dois pedaços vizinhos nunca têm o mesmo run (assim cada pedaço é medido de uma
 * vez, com kerning dentro do run e nunca através da fronteira).
 */
export type Pieces = readonly LineRun[];
/** Largura de um texto que pertence inteiro ao run `run`; o medidor decide como. */
export type MeasureRun = (text: string, run: number) => Pt;
export declare const textOf: (pieces: Pieces) => string;
export declare const widthOf: (pieces: Pieces, measure: MeasureRun) => Pt;
/** Junta dois trechos, fundindo a fronteira quando os dois lados são do mesmo run. */
export declare const concat: (left: Pieces, right: Pieces) => Pieces;
/** Tira espaços do fim (inclusive de pedaços que ficam vazios). */
export declare const trimEnd: (pieces: Pieces) => Pieces;
/** Remove o último caractere (code point, para não partir um par substituto). */
export declare const dropLastChar: (pieces: Pieces) => Pieces;
/** Um pedaço por caractere, cada um com o seu run (base da quebra por caractere). */
export declare const charsOf: (pieces: Pieces) => Pieces;
