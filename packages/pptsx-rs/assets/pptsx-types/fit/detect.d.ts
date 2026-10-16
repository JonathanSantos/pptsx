import type { PositionedSlide } from '../core/types.ts';
export interface Overflow {
    readonly kind: 'text' | 'table' | 'box' | 'slide';
    readonly path: string;
    readonly overflowPt: number;
    readonly overflowPct: number;
    /** M8: só Text com nowrap estoura em 'width'; ausente = altura. */
    readonly axis?: 'width' | 'height';
    /** M11: box-overflow de um item de grid que passa da própria célula (a área é a célula). */
    readonly cell?: boolean;
}
export declare const isWidthOverflow: (overflow: Overflow) => boolean;
/**
 * Pura: lista os estouros do slide posicionado. Absolutos e descendentes nunca geram box/slide.
 * Regras contra duplicata, nesta ordem:
 *  1. text/table estourado não conta para o box do pai;
 *  2. nó fora do slide dentro de um Box com box-overflow não gera slide (a causa é o Box);
 *  3. Text nowrap com estouro de largura não gera slide (o frame alargado é o próprio estouro);
 *  4. no próprio Slide, o que já saiu da página é reportado como slide, não como box do Slide
 *     (out-of-slide diz o lado; o box do Slide fica para o que só invade o padding).
 */
export declare const detectOverflow: (slide: PositionedSlide) => readonly Overflow[];
