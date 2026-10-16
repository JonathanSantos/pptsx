import type { CssStyle, PositionedNode } from '../core/types.ts';
export declare const shadowFilterSvg: (css: CssStyle, id: string) => string;
/** Sombra, fundo, imagem de fundo (cover), bordas e contorno, nessa ordem (a do emissor). */
export declare const decorationSvg: (node: PositionedNode, loadImage: (src: string) => string, index: number) => string;
