import type { TextChildren, TextRun, TextTransform } from '../core/types.ts';
/**
 * Runs de um Text: cada trecho de texto vira um run com o estilo do caminho até ele. O estilo
 * base vem da cascata; o Span aceita fontWeight/fontStyle/textDecoration (weight/italic saíram na 1.0); o
 * textTransform é aplicado antes de medir (o PPTX recebe o texto já transformado).
 */
export type RunStyle = Omit<TextRun, 'text'>;
/** Runs fundidos e transformados de um Text; `content` é a concatenação deles. */
export declare const runsOf: (children: TextChildren, base: RunStyle, transform: TextTransform, path: string) => readonly TextRun[];
