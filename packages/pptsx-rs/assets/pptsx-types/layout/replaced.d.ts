import { type Node as YogaNode } from 'yoga-layout';
import type { CssStyle, Dimensions } from '../core/types.ts';
import type { BuiltNode } from './tree.ts';
interface Constraints {
    readonly minWidth: number;
    readonly maxWidth: number;
    readonly minHeight: number;
    readonly maxHeight: number;
}
interface Size {
    readonly width: number;
    readonly height: number;
}
/** Tamanho natural do conteúdo: px × 0,75; `aspectRatio` do autor substitui a proporção da imagem. */
export declare const naturalSizeOf: (css: CssStyle, intrinsic: Dimensions) => Size;
/**
 * CSS 2.1 §10.4, a tabela inteira. `max` nunca abaixo de `min` (o min vence, como no CSS).
 * Tudo na caixa de conteúdo: é ela que tem a proporção.
 */
export declare const constrainedSizeOf: ({ width: w, height: h }: Size, c: Constraints) => Size;
/**
 * Relayout até o tamanho usado de cada imagem estabilizar. Cada correção pode mudar o bloco
 * de contenção de outra (pai com altura pelo conteúdo), então uma rodada por imagem basta.
 */
export declare const settleReplaced: (root: YogaNode, children: readonly BuiltNode[], size: {
    readonly width: number | undefined;
    readonly height: number | undefined;
}, rootCss?: CssStyle) => void;
export {};
