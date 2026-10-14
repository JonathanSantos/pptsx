import type { LineRun, Pt, TextMeasureInput } from '../core/types.ts';
import { charsOf, concat, dropLastChar, type MeasureRun, type Pieces, textOf, trimEnd, widthOf } from './pieces.ts';
import { runsOfInput, type Segment, type Source, segmentsOf, sourcesOf } from './source.ts';

/**
 * O Yoga devolve larguras em float32: a caixa de um texto medido com largura W
 * volta como W − 1e-6 e a remedição quebraria a linha. 0.01 pt é invisível.
 */
const FIT_TOLERANCE = 0.01;

/** Largura de um trecho de texto em pt (um run só). */
export type MeasureWidth = (text: string) => Pt;

/** Linhas de cada parágrafo do autor; `flat()` dá todas as linhas. */
export type Paragraphs = readonly (readonly string[])[];

export const ELLIPSIS = '…';

/**
 * Parágrafo já quebrado. As linhas são `Pieces` (texto por run): `lines`,
 * `paragraphs` e `lineRuns` saem todos daqui, então ficam coerentes também
 * depois da quebra por caractere e do truncamento.
 */
interface Wrapped {
  readonly lines: readonly Pieces[];
  /** Run da reticência quando a linha cortada não tem caracteres. */
  readonly run: number;
}

const fits = (width: Pt, maxWidth: Pt): boolean => width <= maxWidth + FIT_TOLERANCE;

const lastOf = <T>(items: readonly T[]): T | undefined => items[items.length - 1];

const replaceLast = <T>(items: readonly T[], item: T): readonly T[] => [...items.slice(0, -1), item];

/** Quebra um trecho que não cabe na linha, caractere a caractere (mínimo de 1 por linha). */
const breakWord = (pieces: Pieces, maxWidth: Pt, measure: MeasureRun): readonly Pieces[] =>
  charsOf(pieces).reduce<readonly Pieces[]>((lines, char) => {
    const current = lastOf(lines);
    if (current === undefined) return [[char]];
    const candidate = concat(current, [char]);
    return fits(widthOf(candidate, measure), maxWidth) ? replaceLast(lines, candidate) : [...lines, [char]];
  }, []);

const appendSegment =
  (maxWidth: Pt, measure: MeasureRun) =>
  (lines: readonly Pieces[], { pieces, glue }: Segment): readonly Pieces[] => {
    const current = lastOf(lines);
    if (current !== undefined) {
      const candidate = concat(concat(current, glue), pieces);
      if (fits(widthOf(candidate, measure), maxWidth)) return replaceLast(lines, candidate);
    }
    if (fits(widthOf(pieces, measure), maxWidth)) return [...lines, pieces];
    // O último pedaço vira a linha corrente para que o próximo trecho possa continuar nela.
    return [...lines, ...breakWord(pieces, maxWidth, measure)];
  };

/** Todos os segmentos numa linha só (nowrap, e a "palavra" indivisível do nowrap). */
const joinSegments = (segments: readonly Segment[]): Pieces =>
  segments.reduce<Pieces>(
    (line, { pieces, glue }, index) => (index === 0 ? pieces : concat(concat(line, glue), pieces)),
    [],
  );

/** Quebra gulosa de um parágrafo; vazio = uma linha vazia; nowrap = uma linha. */
const wrapSegments = (segments: readonly Segment[], maxWidth: Pt, measure: MeasureRun, nowrap: boolean): readonly Pieces[] => {
  if (segments.length === 0) return [[]];
  if (nowrap) return [joinSegments(segments)];
  return segments.reduce(appendSegment(maxWidth, measure), []);
};

// Remove caracteres do fim até `linha + '…'` caber; linha vazia aceita o '…' sozinho.
// A reticência pertence ao último run da linha (ou ao do parágrafo, se a linha esvaziou).
const withEllipsis = (line: Pieces, run: number, maxWidth: Pt, measure: MeasureRun): Pieces => {
  const trimmed = trimEnd(line);
  const candidate = concat(trimmed, [{ text: ELLIPSIS, run: lastOf(trimmed)?.run ?? run }]);
  if (trimmed.length === 0 || fits(widthOf(candidate, measure), maxWidth)) return candidate;
  return withEllipsis(dropLastChar(trimmed), run, maxWidth, measure);
};

const countLines = (paragraphs: readonly Wrapped[]): number =>
  paragraphs.reduce((sum, { lines }) => sum + lines.length, 0);

/** Mantém as primeiras `limit` linhas: parágrafos inteiros depois do corte somem. */
const takeLines = (paragraphs: readonly Wrapped[], limit: number): readonly Wrapped[] =>
  paragraphs.reduce<readonly Wrapped[]>((kept, paragraph) => {
    const remaining = limit - countLines(kept);
    if (remaining <= 0) return kept;
    return [...kept, { ...paragraph, lines: paragraph.lines.slice(0, remaining) }];
  }, []);

interface Truncated {
  readonly paragraphs: readonly Wrapped[];
  readonly truncated: boolean;
}

/** Corta em `maxLines` e termina a última linha com '…' que caiba em `maxWidth`. */
const truncate = (
  paragraphs: readonly Wrapped[],
  maxLines: number | undefined,
  maxWidth: Pt,
  measure: MeasureRun,
): Truncated => {
  if (maxLines === undefined) return { paragraphs, truncated: false };
  const limit = Math.max(1, Math.floor(maxLines));
  if (countLines(paragraphs) <= limit) return { paragraphs, truncated: false };
  const kept = takeLines(paragraphs, limit);
  const last = lastOf(kept);
  if (last === undefined) return { paragraphs: kept, truncated: true };
  const ellipsized = replaceLast(last.lines, withEllipsis(lastOf(last.lines) ?? [], last.run, maxWidth, measure));
  return { paragraphs: replaceLast(kept, { ...last, lines: ellipsized }), truncated: true };
};

const widestOf = (lines: readonly Pieces[], measure: MeasureRun): Pt =>
  lines.reduce((widest, line) => Math.max(widest, widthOf(line, measure)), 0);

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
export const layoutText = (input: TextMeasureInput, breakWidth: Pt, measure: MeasureRun): LaidOutText => {
  const nowrap = input.nowrap === true;
  const sources = sourcesOf(input.content, runsOfInput(input));
  const segmented = sources.map((source: Source) => ({ source, segments: segmentsOf(source) }));
  const wrapped = segmented.map(({ source, segments }) => ({
    lines: wrapSegments(segments, breakWidth, measure, nowrap),
    run: source.run,
  }));
  // Com nowrap a linha nunca é cortada por largura: a reticência só marca parágrafos que sumiram.
  const { paragraphs, truncated } = truncate(wrapped, input.maxLines, nowrap ? Infinity : breakWidth, measure);
  const lineRuns = paragraphs.flatMap(({ lines }) => lines);
  const indivisible = segmented.flatMap(({ segments }) =>
    nowrap ? [joinSegments(segments)] : segments.map((segment) => segment.pieces),
  );
  return {
    paragraphs: paragraphs.map(({ lines }) => lines.map(textOf)),
    lines: lineRuns.map(textOf),
    lineRuns,
    truncated,
    widestLine: widestOf(lineRuns.map(trimEnd), measure),
    widestSegment: widestOf(indivisible, measure),
  };
};

/** Quebra gulosa de um único parágrafo (sem '\n') num run só. Parágrafo vazio = uma linha vazia. */
export const breakLines = (paragraph: string, maxWidth: Pt, measureWidth: MeasureWidth): readonly string[] => {
  const source: Source = { text: paragraph, spans: [{ start: 0, end: paragraph.length, run: 0 }], run: 0 };
  return wrapSegments(segmentsOf(source), maxWidth, (text) => measureWidth(text), false).map(textOf);
};
