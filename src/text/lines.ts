import type { Pt } from '../core/types.ts';

/** Largura de um trecho de texto em pt; o medidor decide como (estimativa, fontkit...). */
export type MeasureWidth = (text: string) => Pt;

export const ELLIPSIS = '…';

const lastOf = (lines: readonly string[]): string | undefined => lines[lines.length - 1];

const replaceLast = (lines: readonly string[], line: string): readonly string[] => [...lines.slice(0, -1), line];

/** Quebra uma palavra que não cabe na linha, caractere a caractere (mínimo de 1 por linha). */
export const breakWord = (word: string, maxWidth: Pt, measureWidth: MeasureWidth): readonly string[] =>
  [...word].reduce<readonly string[]>((pieces, char) => {
    const current = lastOf(pieces);
    if (current === undefined) return [char];
    const candidate = current + char;
    return measureWidth(candidate) <= maxWidth ? replaceLast(pieces, candidate) : [...pieces, char];
  }, []);

const appendWord =
  (maxWidth: Pt, measureWidth: MeasureWidth) =>
  (lines: readonly string[], word: string): readonly string[] => {
    const current = lastOf(lines);
    if (current !== undefined) {
      const candidate = `${current} ${word}`;
      if (measureWidth(candidate) <= maxWidth) return replaceLast(lines, candidate);
    }
    if (measureWidth(word) <= maxWidth) return [...lines, word];
    // O último pedaço vira a linha corrente para que a próxima palavra possa continuar nela.
    return [...lines, ...breakWord(word, maxWidth, measureWidth)];
  };

/** Quebra gulosa por palavra de um único parágrafo (sem '\n'). Parágrafo vazio = uma linha vazia. */
export const breakLines = (paragraph: string, maxWidth: Pt, measureWidth: MeasureWidth): readonly string[] => {
  const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [''];
  return words.reduce(appendWord(maxWidth, measureWidth), []);
};

/** Parágrafos separados por '\n', cada um quebrado de forma gulosa. */
export const wrapText = (content: string, maxWidth: Pt, measureWidth: MeasureWidth): readonly string[] =>
  content.split('\n').flatMap((paragraph) => breakLines(paragraph, maxWidth, measureWidth));

export interface TruncatedLines {
  readonly lines: readonly string[];
  readonly truncated: boolean;
}

// Remove caracteres do fim até `linha + '…'` caber; linha vazia aceita o '…' sozinho.
const withEllipsis = (line: string, maxWidth: Pt, measureWidth: MeasureWidth): string => {
  const trimmed = line.trimEnd();
  const candidate = trimmed + ELLIPSIS;
  if (trimmed.length === 0 || measureWidth(candidate) <= maxWidth) return candidate;
  return withEllipsis(trimmed.slice(0, -1), maxWidth, measureWidth);
};

/** Corta em `maxLines` e termina a última linha com '…'. */
export const truncateLines = (
  lines: readonly string[],
  maxLines: number,
  maxWidth: Pt,
  measureWidth: MeasureWidth,
): TruncatedLines => {
  const limit = Math.max(1, Math.floor(maxLines));
  if (lines.length <= limit) return { lines, truncated: false };
  const kept = lines.slice(0, limit);
  const last = lastOf(kept) ?? '';
  return { lines: replaceLast(kept, withEllipsis(last, maxWidth, measureWidth)), truncated: true };
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
): TruncatedLines => {
  const lines = wrapText(content, maxWidth, measureWidth);
  if (maxLines === undefined) return { lines, truncated: false };
  return truncateLines(lines, maxLines, maxWidth, measureWidth);
};
