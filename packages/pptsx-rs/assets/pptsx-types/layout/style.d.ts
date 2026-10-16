import { Align as YogaAlign, FlexDirection as YogaFlexDirection, Justify as YogaJustify, PositionType, Wrap } from 'yoga-layout';
import type { CssAlign, CssStyle, Dimensions, FlexDirection, Len, MarginLen, Sides } from '../core/types.ts';
/**
 * CSS normalizado → descrição declarativa do nó Yoga (separada da aplicação, testável sem
 * criar nós). Box-sizing é sempre border-box, que é o modelo do Yoga.
 */
export interface YogaStyle {
    readonly flexDirection?: YogaFlexDirection;
    readonly flexWrap?: Wrap;
    readonly justifyContent?: YogaJustify;
    readonly alignItems?: YogaAlign;
    readonly alignContent?: YogaAlign;
    readonly alignSelf?: YogaAlign;
    readonly rowGap?: number;
    readonly columnGap?: number;
    readonly padding?: Partial<Sides<Len>>;
    readonly border?: Partial<Sides<number>>;
    readonly margin?: Partial<Sides<MarginLen>>;
    readonly flexGrow?: number;
    readonly flexShrink?: number;
    readonly flexBasis?: Len | 'auto';
    readonly width?: Len;
    readonly height?: Len;
    readonly minWidth?: Len;
    readonly maxWidth?: Len;
    readonly minHeight?: Len;
    readonly maxHeight?: Len;
    readonly positionType?: PositionType;
    readonly position?: Partial<Sides<Len>>;
    readonly aspectRatio?: number;
}
/** Eixo principal do contêiner (o reverse não muda o eixo). */
export declare const mainAxisOf: (css: CssStyle) => FlexDirection;
/** O que o item precisa saber do pai para virar estilo Yoga. */
export interface ParentLayout {
    /** Eixo principal do pai. */
    readonly direction: FlexDirection;
    readonly display: CssStyle['display'];
    readonly alignItems: CssAlign;
    /** A baseline do pai é lida por um ancestral (então a dos filhos também importa). */
    readonly baseline: boolean;
}
/** Caixa (padding + borda) de qualquer nó: no CSS todo elemento tem box model, inclusive Text e Image. */
export declare const toBoxStyle: (css: CssStyle) => YogaStyle;
export declare const toContainerStyle: (css: CssStyle) => YogaStyle;
/** Item de flex (ou de block): o eixo principal é o do PAI. */
export declare const toItemStyle: (css: CssStyle, parent: ParentLayout, contentLeaf?: boolean) => YogaStyle;
/**
 * O pai lê a baseline deste item: alinhado por baseline numa row, ou dentro de um Box cuja
 * baseline já é lida (a baseline do Box é a do 1º filho, recursivamente).
 */
export declare const readsBaseline: (css: CssStyle, parent: ParentLayout) => boolean;
/** nowrap numa row: o Yoga não pode espremer a caixa abaixo da linha (o fit vê o estouro). */
export declare const withLineMinWidth: (style: YogaStyle, lineWidth: number) => YogaStyle;
/**
 * Imagem: com as duas dimensões, nada a fazer; com uma, a outra vem da proporção; com grow,
 * o flex decide a caixa; sem nada, tamanho natural (px × 0,75).
 */
export declare const toImageStyle: (css: CssStyle, intrinsic: Dimensions, parent: ParentLayout) => YogaStyle;
