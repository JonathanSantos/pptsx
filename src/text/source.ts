import { DEFAULTS } from '../core/defaults.ts';
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

// Palavra = sequência sem espaço que quebra; NBSP (U+00A0) é cola, fica dentro da palavra.
const WORD = /[\S ]+/g;

// Corta DEPOIS de '-'/'/', mantendo-os no trecho. Hífen/barra no início ficam
// grudados no que vem depois ("-5" não quebra), e sequências ("//") não se separam.
const BREAK_AFTER = /[-/]*[^-/]+[-/]*|[-/]+/g;

const styleRunOf = (input: TextMeasureInput): TextRun => ({
  text: input.content,
  weight: input.style.weight,
  italic: input.style.italic,
  color: DEFAULTS.text.color,
});

/**
 * Runs efetivos da medição: sem runs (ou sem nenhum, com conteúdo vazio) vale um run
 * com o estilo base. Runs que não somam o conteúdo são erro de quem chamou: medir
 * assim daria linhas que o emissor não consegue reconstruir.
 */
export const runsOfInput = (input: TextMeasureInput): readonly TextRun[] => {
  const { runs, content } = input;
  if (runs === undefined || (runs.length === 0 && content === '')) return [styleRunOf(input)];
  if (runs.map((run) => run.text).join('') !== content) {
    throw new Error('TextMeasureInput.runs não corresponde a content: a concatenação de runs[].text tem que ser igual a content');
  }
  return runs;
};

const spansOf = (runs: readonly TextRun[]): readonly Span[] =>
  runs.reduce<readonly Span[]>((spans, { text }, run) => {
    const start = spans[spans.length - 1]?.end ?? 0;
    return [...spans, { start, end: start + text.length, run }];
  }, []);

const runAtOffset = (spans: readonly Span[], offset: number): number | undefined =>
  spans.find((span) => span.start <= offset && offset < span.end)?.run;

const clip = (spans: readonly Span[], start: number, end: number): readonly Span[] =>
  spans
    .map((span) => ({ start: Math.max(span.start, start) - start, end: Math.min(span.end, end) - start, run: span.run }))
    .filter((span) => span.end > span.start);

const paragraphStartsOf = (paragraphs: readonly string[]): readonly number[] =>
  paragraphs.reduce<readonly number[]>(
    (starts, _paragraph, index) =>
      index === 0 ? [0] : [...starts, (starts[index - 1] ?? 0) + (paragraphs[index - 1]?.length ?? 0) + 1],
    [],
  );

/** Parágrafos por '\n', cada um com seus trechos por run (offsets relativos ao parágrafo). */
export const sourcesOf = (content: string, runs: readonly TextRun[]): readonly Source[] => {
  const spans = spansOf(runs);
  const paragraphs = content.split('\n');
  const starts = paragraphStartsOf(paragraphs);
  return paragraphs.map((text, index) => {
    const start = starts[index] ?? 0;
    const clipped = clip(spans, start, start + text.length);
    // Parágrafo vazio herda o run do '\n' vizinho: é o estilo que o autor escreveu ali.
    const run = clipped[0]?.run ?? runAtOffset(spans, start - 1) ?? runAtOffset(spans, start) ?? 0;
    return { text, spans: clipped, run };
  });
};

/** Pedaços por run do intervalo [start, end) do parágrafo. */
export const piecesOf = (source: Source, start: number, end: number): Pieces =>
  clip(source.spans, start, end).map((span) => ({
    text: source.text.slice(span.start + start, span.end + start),
    run: span.run,
  }));

const runAt = (source: Source, offset: number): number => runAtOffset(source.spans, offset) ?? source.run;

const segmentsOfWord = (source: Source, word: string, start: number): readonly Segment[] => {
  const parts = word.match(BREAK_AFTER) ?? [word];
  // O espaço que separa esta palavra da anterior é o último caractere antes dela.
  const space: Pieces = [{ text: ' ', run: runAt(source, Math.max(0, start - 1)) }];
  return parts.reduce<readonly Segment[]>((segments, part, index) => {
    const from = start + parts.slice(0, index).reduce((sum, previous) => sum + previous.length, 0);
    return [...segments, { pieces: piecesOf(source, from, from + part.length), glue: index === 0 ? space : [] }];
  }, []);
};

/** Palavras separadas por espaço (exceto NBSP), cada uma dividida depois de '-' e '/'. */
export const segmentsOf = (source: Source): readonly Segment[] =>
  [...source.text.matchAll(WORD)].flatMap((match) => segmentsOfWord(source, match[0], match.index));
