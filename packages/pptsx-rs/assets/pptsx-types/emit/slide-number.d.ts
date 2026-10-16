import type { PositionedText, Rect } from '../core/types.ts';
import type * as Pptx from './pptx.ts';
export declare const withSlideNumberField: (runs: Pptx.TextProps[], node: PositionedText) => Pptx.TextProps[];
/** Troca cada run marcado pelo campo; o resto do XML fica intacto. */
export declare const applySlideNumberFields: (xml: string) => string;
export interface TextBox {
    readonly runs: Pptx.TextProps[];
    readonly options: Pptx.TextPropsOptions;
    readonly frame: Rect;
}
/**
 * Caixas de texto de um Text. SlideNumber "n / total": o número (campo) numa caixa do tamanho dele e
 * o resto noutra, encostada; as duas alinhadas à esquerda a partir de onde o rótulo começaria pelo
 * `align` do Text. Qualquer outro Text: uma caixa só, como antes.
 */
export declare const slideNumberBoxesOf: (node: PositionedText, runs: Pptx.TextProps[], options: Pptx.TextPropsOptions) => readonly TextBox[];
