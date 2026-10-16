import { type Paragraphs } from './lines.ts';
/**
 * Palavras partidas por caractere (sem ponto de quebra) nas linhas visíveis, sem
 * repetição. Reconstruído a partir das linhas para que o medidor e o ajuste usem
 * exatamente o mesmo critério, inclusive depois do truncamento.
 */
export declare const brokenWordsOf: (content: string, paragraphs: Paragraphs) => readonly string[];
