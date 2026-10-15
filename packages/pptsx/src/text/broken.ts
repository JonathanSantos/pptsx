import { ELLIPSIS, type Paragraphs } from './lines.ts';

// Pontos de quebra legítimos que não consomem caractere (ver segmentsOf em lines.ts).
const BREAKS_AFTER = new Set(['-', '/']);

/**
 * Mesma normalização da quebra: palavras separadas por um único espaço. NBSP não
 * separa palavras (é cola): fica como está, e uma fronteira de linha nele é quebra por caractere.
 */
const normalize = (paragraph: string): string =>
  paragraph
    .split(/[^\S\u00A0]+/)
    .filter((word) => word.length > 0)
    .join(' ');

/** Palavra (entre espaços) que contém a posição `at` do parágrafo normalizado. */
const wordAt = (text: string, at: number): string => {
  const start = text.lastIndexOf(' ', at - 1) + 1;
  const end = text.indexOf(' ', at);
  return text.slice(start, end === -1 ? text.length : end);
};

/**
 * Percorre as linhas de um parágrafo contra o texto original: cada fronteira de
 * linha deve cair num espaço ou logo depois de '-'/'/'; qualquer outra é uma
 * palavra quebrada por caractere. A linha com reticências encerra a busca:
 * o que vem depois dela não aparece no slide.
 */
const brokenInParagraph = (paragraph: string, lines: readonly string[]): readonly string[] => {
  const text = normalize(paragraph);
  const walk = (index: number, cursor: number, found: readonly string[]): readonly string[] => {
    const line = lines[index];
    if (line === undefined || line.endsWith(ELLIPSIS)) return found;
    if (text.slice(cursor, cursor + line.length) !== line) return found;
    const end = cursor + line.length;
    if (end >= text.length) return found;
    if (text[end] === ' ') return walk(index + 1, end + 1, found);
    if (BREAKS_AFTER.has(line.at(-1) ?? '')) return walk(index + 1, end, found);
    return walk(index + 1, end, [...found, wordAt(text, end)]);
  };
  return walk(0, 0, []);
};

/**
 * Palavras partidas por caractere (sem ponto de quebra) nas linhas visíveis, sem
 * repetição. Reconstruído a partir das linhas para que o medidor e o ajuste usem
 * exatamente o mesmo critério, inclusive depois do truncamento.
 */
export const brokenWordsOf = (content: string, paragraphs: Paragraphs): readonly string[] => {
  const sources = content.split('\n');
  const words = paragraphs.flatMap((lines, index) => brokenInParagraph(sources[index] ?? '', lines));
  return [...new Set(words)];
};
