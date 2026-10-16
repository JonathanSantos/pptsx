import type * as Pptx from './pptx.ts';
import type { Color, LineBreaks, LineRun, PositionedText, TextLayout, VerticalAlign } from '../core/types.ts';
/**
 * Texto → runs do pptxgenjs (M8: rich text). Funções puras.
 *
 * Duas estratégias de quebra (Strategy por `LineBreaks`):
 * - 'forced' (padrão, decisão do gate do M3): cada linha calculada vira um ou mais
 *   runs (um por `LineRun`). Linhas do mesmo parágrafo são unidas por quebra suave
 *   (softBreakBefore no 1º run da linha → <a:br/>) e o último run da última linha de
 *   cada parágrafo, exceto o final, fecha o <a:p> (breakLine). Assim o renderizador
 *   não requebra o texto com a própria métrica; com quebra automática o Keynote punha
 *   mais palavras por linha que a engine (11/34 na calibração; 34/34 com a forçada).
 * - 'auto': um <a:p> por parágrafo do autor, com um run por `TextRun`; o renderizador
 *   quebra sozinho. O texto fica editável como texto corrido, ao custo de poder
 *   divergir em 1 linha da engine. A caixa mantém o frame calculado.
 * Runs separados (em vez de '\n') nas duas: o pptxgenjs ignora todas as quebras
 * quando o texto termina em '\n'.
 */
/** O que pode variar entre runs de um Text; fonte, size e lang são da caixa. */
export interface RunStyle {
    readonly bold: boolean;
    readonly italic: boolean;
    /** Hex sem '#', como o pptxgenjs espera. */
    readonly color: string;
    /** M11: `textDecoration` do Text ou do Span. */
    readonly underline: boolean;
    readonly lineThrough: boolean;
    /** M13: `<a:latin typeface>` do run quando difere da caixa (face de peso não 400/700). */
    readonly typeface?: string;
    /** M13: sobrescrito/subscrito (ausente = baseline). */
    readonly verticalAlign?: VerticalAlign;
    /** M13: link do trecho (já traduzido para o deck de saída). */
    readonly href?: string;
    /** M13-7: corpo do trecho quando difere do Text. */
    readonly size?: number;
}
/** Pedaço de texto com estilo: vira um <a:r>. */
export interface StyledText {
    readonly text: string;
    readonly style: RunStyle;
}
export type StyledLine = readonly StyledText[];
export type StyledParagraph = readonly StyledLine[];
/** pptxgenjs espera hex sem '#'. */
export declare const hexOf: (color: Color) => string;
export declare const baseStyleOf: (node: PositionedText) => RunStyle;
export declare const lineRunsOf: (layout: TextLayout) => readonly (readonly LineRun[])[] | undefined;
/** Funde pedaços vizinhos com o mesmo estilo (ex.: um run que atravessou linhas). */
export declare const mergeAdjacent: (line: StyledLine) => StyledLine;
/** Linhas calculadas por parágrafo, cada uma dividida pelos runs. */
export declare const computedParagraphsOf: (node: PositionedText, base?: RunStyle) => readonly StyledParagraph[];
/** Espaços colapsados e aparados nas pontas, preservando NBSP (texto puro de célula de tabela). */
export declare const collapseSpaces: (text: string) => string;
/** Linhas calculadas unidas em texto corrido; só para truncado, que precisa manter a reticência. */
export declare const joinedLinesOf: (lines: readonly StyledLine[]) => StyledLine;
/** Divide os runs nos '\n' do autor: um run que cruza '\n' vira um pedaço em cada parágrafo. */
export declare const splitParagraphs: (pieces: StyledLine) => readonly StyledLine[];
/** Espaços do parágrafo normalizados como o medidor, através das fronteiras de run. */
export declare const normalizeParagraph: (pieces: StyledLine) => StyledLine;
/**
 * Parágrafos do autor divididos pelos runs. Reconstruir a partir das linhas erra em
 * palavra quebrada por caractere (espaço falso) e em "a - b" (o espaço antes do '-'
 * some); o texto original não tem esse problema. Truncado não tem original
 * confiável (os parágrafos depois do corte somem e o último ganha '…'), então usa
 * as linhas calculadas unidas.
 */
export declare const authorParagraphsOf: (node: PositionedText, base?: RunStyle) => readonly StyledParagraph[];
/**
 * softBreakBefore só no 1º run de cada linha depois da 1ª; breakLine só no último run do parágrafo.
 * M13-7: `spacings[p]` (pt) vai no 1º run do parágrafo p como `lineSpacing` (o pPr do parágrafo).
 */
export declare const pptxRunsOf: (paragraphs: readonly StyledParagraph[], base: RunStyle, spacings?: readonly number[]) => Pptx.TextProps[];
export declare const textRunsOfNode: (node: PositionedText, lineBreaks?: LineBreaks) => Pptx.TextProps[];
