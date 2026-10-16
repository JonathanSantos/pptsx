import type { BasisSource, BorderStyle, CssAlign, CssAlignContent, CssFlexDirection, CssFlexWrap, CssJustify, CssPlace, CssPosition, Display, FontWeight, GridPlacement, Len, MarginLen, NotEmitted, Shadow, Sides, TextAlign, TextDecoration, TextTransform } from '../core/types.ts';
/**
 * Rascunho da normalização: o que o autor declarou num nó, tudo opcional. Os handlers por
 * propriedade (`*-handlers.ts`) só acrescentam ao rascunho; `normalize.ts` aplica os
 * padrões por kind no fim. Puro: nada aqui depende de ordem global.
 */
/** Propriedades de texto que descem do Slide/Box para os Text (CSS: inherited). */
export interface InheritedText {
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly weight?: FontWeight;
    readonly italic?: boolean;
    readonly color?: string;
    readonly lineHeight?: number | 'normal';
    readonly textAlign?: TextAlign;
    readonly letterSpacing?: number;
    readonly textTransform?: TextTransform;
}
export declare const ROOT_TEXT: InheritedText;
export interface BorderDraft {
    readonly width?: number;
    readonly style?: BorderStyle;
    readonly color?: string;
    readonly alpha?: number;
}
export type SizeKey = 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight';
export type GridTrackKey = 'gridTemplateColumns' | 'gridTemplateRows' | 'gridAutoRows' | 'gridAutoColumns';
export interface Draft {
    readonly display?: Display;
    readonly position?: CssPosition;
    readonly inset: Partial<Sides<Len>>;
    readonly sizes: Partial<Record<SizeKey, Len>>;
    readonly aspectRatio?: number;
    readonly flexDirection?: CssFlexDirection;
    readonly flexWrap?: CssFlexWrap;
    readonly justifyContent?: CssJustify;
    readonly alignItems?: CssAlign;
    readonly alignContent?: CssAlignContent;
    readonly alignSelf?: CssAlign;
    readonly justifySelf?: CssPlace;
    readonly justifyItems?: CssPlace;
    readonly flexGrow?: number;
    readonly flexShrink?: number;
    readonly flexBasis?: Len | 'auto';
    readonly basisSource: BasisSource;
    readonly order?: number;
    readonly rowGap?: number;
    readonly columnGap?: number;
    readonly margin: Partial<Sides<MarginLen>>;
    readonly padding: Partial<Sides<Len>>;
    readonly border: Partial<Sides<BorderDraft>>;
    readonly borderRadius?: number;
    readonly backgroundColor?: string;
    readonly backgroundAlpha?: number;
    readonly backgroundImage?: string;
    /** Sem cor = currentColor (resolvida no fim, com a cor de texto herdada). */
    readonly outline?: {
        readonly color?: string;
        readonly width: number;
    };
    readonly boxShadow?: Shadow;
    readonly opacity?: number;
    readonly rotate: number;
    readonly translate: {
        readonly x: number;
        readonly y: number;
    };
    readonly zIndex?: number;
    readonly overflow?: 'visible' | 'hidden';
    readonly grid: Partial<Record<GridTrackKey, string>>;
    readonly gridColumn?: GridPlacement;
    readonly gridRow?: GridPlacement;
    readonly text: InheritedText;
    readonly textDecoration?: TextDecoration;
    /** Props que a primitiva consome direto (src, data, fit, nowrap, kind…), já com os nomes da engine. */
    readonly own: Readonly<Record<string, unknown>>;
    readonly notEmitted: readonly NotEmitted[];
}
export declare const EMPTY_DRAFT: Draft;
export type Handler = (draft: Draft, value: unknown, key: string) => Draft;
/** Propriedade que chegou e não sai no PPTX: fica registrada para o fit avisar (css-not-emitted). */
export declare const reject: (draft: Draft, key: string, value: unknown, reason: string) => Draft;
export declare const INVALID = "valor n\u00E3o reconhecido; ignorado";
/** Handler que só aceita o valor quando o parser entende; senão vira css-not-emitted. */
export declare const parsed: <T>(parse: (value: unknown) => T | undefined, apply: (draft: Draft, value: T) => Draft) => Handler;
export declare const setField: <K extends keyof Draft>(field: K, parse: (value: unknown) => Draft[K] | undefined) => Handler;
export declare const setText: <K extends keyof InheritedText>(field: K, parse: (value: unknown) => InheritedText[K] | undefined) => Handler;
/** Guarda o valor cru em `own` (props da primitiva com significado da engine). */
export declare const pass: (field: string) => Handler;
export declare const finiteNumber: (value: unknown) => number | undefined;
