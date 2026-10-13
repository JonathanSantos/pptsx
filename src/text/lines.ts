import type { Pt } from '../core/types.ts';

/**
 * O Yoga devolve larguras em float32: a caixa de um texto medido com largura W
 * volta como W − 1e-6 e a remedição quebraria a linha. 0.01 pt é invisível.
 */
const FIT_TOLERANCE = 0.01;

/** Largura de um trecho de texto em pt; o medidor decide como (estimativa, fontkit...). */
export type MeasureWidth = (text: string) => Pt;

/** Linhas de cada parágrafo do autor; `flat()` dá todas as linhas. */
export type Paragraphs = readonly (readonly string[])[];

export const ELLIPSIS = '…';

/**
 * Trecho indivisível na quebra gulosa. `glue` é o que o separa do trecho
 * anterior quando os dois ficam na mesma linha: ' ' entre palavras, '' depois
 * de '-' ou '/' (o caractere já está no fim do trecho anterior).
 */
interface Segment {
  readonly text: string;
  readonly glue: string;
}

// Corta DEPOIS de '-'/'/', mantendo-os no trecho. Hífen/barra no início ficam
// grudados no que vem depois ("-5" não quebra), e sequências ("//") não se separam.
const BREAK_AFTER = /[-/]*[^-/]+[-/]*|[-/]+/g;

const lastOf = <T>(items: readonly T[]): T | undefined => items[items.length - 1];

const replaceLast = <T>(items: readonly T[], item: T): readonly T[] => [...items.slice(0, -1), item];

const segmentsOfWord = (word: string): readonly Segment[] =>
  (word.match(BREAK_AFTER) ?? [word]).map((text, index) => ({ text, glue: index === 0 ? ' ' : '' }));

/** Palavras separadas por espaço, cada uma dividida depois de '-' e '/'. */
export const segmentsOf = (paragraph: string): readonly Segment[] =>
  paragraph
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .flatMap(segmentsOfWord);

/** Quebra um trecho que não cabe na linha, caractere a caractere (mínimo de 1 por linha). */
export const breakWord = (word: string, maxWidth: Pt, measureWidth: MeasureWidth): readonly string[] =>
  [...word].reduce<readonly string[]>((pieces, char) => {
    const current = lastOf(pieces);
    if (current === undefined) return [char];
    const candidate = current + char;
    return measureWidth(candidate) <= maxWidth + FIT_TOLERANCE ? replaceLast(pieces, candidate) : [...pieces, char];
  }, []);

const appendSegment =
  (maxWidth: Pt, measureWidth: MeasureWidth) =>
  (lines: readonly string[], { text, glue }: Segment): readonly string[] => {
    const current = lastOf(lines);
    if (current !== undefined) {
      const candidate = current + glue + text;
      if (measureWidth(candidate) <= maxWidth + FIT_TOLERANCE) return replaceLast(lines, candidate);
    }
    if (measureWidth(text) <= maxWidth + FIT_TOLERANCE) return [...lines, text];
    // O último pedaço vira a linha corrente para que o próximo trecho possa continuar nela.
    return [...lines, ...breakWord(text, maxWidth, measureWidth)];
  };

/** Quebra gulosa de um único parágrafo (sem '\n'). Parágrafo vazio = uma linha vazia. */
export const breakLines = (paragraph: string, maxWidth: Pt, measureWidth: MeasureWidth): readonly string[] => {
  const segments = segmentsOf(paragraph);
  if (segments.length === 0) return [''];
  return segments.reduce(appendSegment(maxWidth, measureWidth), []);
};

/** Parágrafos separados por '\n', cada um quebrado de forma gulosa. */
export const wrapParagraphs = (content: string, maxWidth: Pt, measureWidth: MeasureWidth): Paragraphs =>
  content.split('\n').map((paragraph) => breakLines(paragraph, maxWidth, measureWidth));

export interface WrappedText {
  readonly paragraphs: Paragraphs;
  readonly lines: readonly string[];
  readonly truncated: boolean;
}

const wrappedOf = (paragraphs: Paragraphs, truncated: boolean): WrappedText => ({
  paragraphs,
  lines: paragraphs.flat(),
  truncated,
});

// Remove caracteres do fim até `linha + '…'` caber; linha vazia aceita o '…' sozinho.
const withEllipsis = (line: string, maxWidth: Pt, measureWidth: MeasureWidth): string => {
  const trimmed = line.trimEnd();
  const candidate = trimmed + ELLIPSIS;
  if (trimmed.length === 0 || measureWidth(candidate) <= maxWidth + FIT_TOLERANCE) return candidate;
  return withEllipsis(trimmed.slice(0, -1), maxWidth, measureWidth);
};

const countLines = (paragraphs: Paragraphs): number => paragraphs.reduce((sum, lines) => sum + lines.length, 0);

/** Mantém as primeiras `limit` linhas: parágrafos inteiros depois do corte somem. */
export const takeLines = (paragraphs: Paragraphs, limit: number): Paragraphs =>
  paragraphs.reduce<Paragraphs>((kept, lines) => {
    const remaining = limit - countLines(kept);
    if (remaining <= 0) return kept;
    return [...kept, lines.slice(0, remaining)];
  }, []);

/** Corta em `maxLines` e termina a última linha com '…'. */
export const truncateParagraphs = (
  paragraphs: Paragraphs,
  maxLines: number,
  maxWidth: Pt,
  measureWidth: MeasureWidth,
): WrappedText => {
  const limit = Math.max(1, Math.floor(maxLines));
  if (countLines(paragraphs) <= limit) return wrappedOf(paragraphs, false);
  const kept = takeLines(paragraphs, limit);
  const lastParagraph = lastOf(kept) ?? [''];
  const ellipsized = replaceLast(lastParagraph, withEllipsis(lastOf(lastParagraph) ?? '', maxWidth, measureWidth));
  return wrappedOf(replaceLast(kept, ellipsized), true);
};

/** Largura da linha mais longa, sem espaço final. */
export const widestLine = (lines: readonly string[], measureWidth: MeasureWidth): Pt =>
  lines.reduce((widest, line) => Math.max(widest, measureWidth(line.trimEnd())), 0);

/** Quebra o conteúdo em `maxWidth` e, se houver `maxLines`, corta com reticências. */
export const layoutLines = (
  content: string,
  maxWidth: Pt,
  maxLines: number | undefined,
  measureWidth: MeasureWidth,
): WrappedText => {
  const paragraphs = wrapParagraphs(content, maxWidth, measureWidth);
  if (maxLines === undefined) return wrappedOf(paragraphs, false);
  return truncateParagraphs(paragraphs, maxLines, maxWidth, measureWidth);
};
