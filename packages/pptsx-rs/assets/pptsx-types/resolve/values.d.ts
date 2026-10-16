import type { BorderStyle, FontWeight, GridLine, GridPlacement, Len, MarginLen, Shadow, Sides } from '../core/types.ts';
export declare const parseLength: (value: unknown) => Len | undefined;
/** Só pt (gap, raio, sombra, letterSpacing): % não tem base nesses lugares. */
export declare const parsePt: (value: unknown) => number | undefined;
export declare const parseMargin: (value: unknown) => MarginLen | undefined;
/**
 * Shorthand de caixa (`margin`, `padding`, `inset`): número, '8 16', '8px auto 0' ou o
 * objeto da engine ({ top, left }); lados ausentes do objeto ficam de fora (undefined).
 */
export declare const parseSides: <T>(value: unknown, parse: (item: unknown) => T | undefined) => Partial<Sides<T>> | undefined;
export interface ParsedColor {
    readonly hex: string;
    readonly alpha: number;
}
export declare const parseColor: (value: unknown) => ParsedColor | undefined;
export interface ParsedBorder {
    readonly width?: number;
    readonly style?: BorderStyle;
    readonly color?: ParsedColor;
}
/** `2px solid #2F6FED`, `1 dashed`, `none` ou só a largura (número). Ordem livre, como no CSS. */
export declare const parseBorder: (value: unknown) => ParsedBorder | undefined;
export declare const parseBorderStyle: (value: unknown) => BorderStyle | undefined;
/** `x y [blur [spread]] color [inset]`; só a primeira sombra de uma lista (o PPTX tem uma). */
export declare const parseShadow: (value: unknown) => {
    readonly shadow: Shadow;
    readonly extra: boolean;
} | undefined;
export interface ParsedFlex {
    readonly grow: number;
    readonly shrink: number;
    readonly basis: Len | 'auto';
    /** `flex: n` (basis 0 implícito) — distinto de basis 0 escrito pelo autor. */
    readonly implicitZero: boolean;
}
/** `flex: 1`, `flex: 'auto'`, `'none'`, `'1 0 120px'`, `'2 1'`. */
export declare const parseFlex: (value: unknown) => ParsedFlex | undefined;
export declare const parseAngle: (value: unknown) => number | undefined;
export interface ParsedTransform {
    readonly rotate: number;
    readonly translate: {
        readonly x: number;
        readonly y: number;
    };
    /** Funções sem de/para (scale, skew, matrix…), como o autor escreveu. */
    readonly unsupported: readonly string[];
}
export declare const parseTransform: (value: unknown) => ParsedTransform | undefined;
export declare const parseGridLine: (value: unknown) => GridLine | undefined;
/** `gridColumn: '1 / 3'`, `'span 2'`, `'2'`, `'1 / -1'`, número. */
export declare const parseGridPlacement: (value: unknown) => GridPlacement | undefined;
/**
 * M13: `bold`, `normal`/`regular` ou número de 1 a 1000 (CSS Fonts 4), já na forma canônica
 * (400 → 'regular', 700 → 'bold'). A face usada é escolhida na medição.
 */
export declare const parseFontWeight: (value: unknown) => FontWeight | undefined;
