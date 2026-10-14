import type { LineRun, Pt } from '../core/types.ts';

/**
 * Trecho de texto dividido por run, na ordem. Invariantes: nenhum pedaço vazio e
 * dois pedaços vizinhos nunca têm o mesmo run (assim cada pedaço é medido de uma
 * vez, com kerning dentro do run e nunca através da fronteira).
 */
export type Pieces = readonly LineRun[];

/** Largura de um texto que pertence inteiro ao run `run`; o medidor decide como. */
export type MeasureRun = (text: string, run: number) => Pt;

export const textOf = (pieces: Pieces): string => pieces.map((piece) => piece.text).join('');

export const widthOf = (pieces: Pieces, measure: MeasureRun): Pt =>
  pieces.reduce((sum, piece) => sum + measure(piece.text, piece.run), 0);

/** Junta dois trechos, fundindo a fronteira quando os dois lados são do mesmo run. */
export const concat = (left: Pieces, right: Pieces): Pieces => {
  const last = left[left.length - 1];
  const [first, ...rest] = right;
  if (last === undefined || first === undefined) return [...left, ...right];
  if (last.run !== first.run) return [...left, ...right];
  return [...left.slice(0, -1), { text: last.text + first.text, run: last.run }, ...rest];
};

const withLastText = (pieces: Pieces, text: string): Pieces => {
  const last = pieces[pieces.length - 1];
  const rest = pieces.slice(0, -1);
  if (last === undefined || text.length === 0) return rest;
  return [...rest, { text, run: last.run }];
};

/** Tira espaços do fim (inclusive de pedaços que ficam vazios). */
export const trimEnd = (pieces: Pieces): Pieces => {
  const last = pieces[pieces.length - 1];
  if (last === undefined) return pieces;
  const trimmed = last.text.trimEnd();
  if (trimmed === last.text) return pieces;
  if (trimmed.length > 0) return withLastText(pieces, trimmed);
  return trimEnd(pieces.slice(0, -1));
};

/** Remove o último caractere (code point, para não partir um par substituto). */
export const dropLastChar = (pieces: Pieces): Pieces => {
  const last = pieces[pieces.length - 1];
  if (last === undefined) return pieces;
  return withLastText(pieces, [...last.text].slice(0, -1).join(''));
};

/** Um pedaço por caractere, cada um com o seu run (base da quebra por caractere). */
export const charsOf = (pieces: Pieces): Pieces =>
  pieces.flatMap((piece) => [...piece.text].map((text) => ({ text, run: piece.run })));
