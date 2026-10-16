import type { CssStyle, LineCap, LineJoin, PathCommand, PositionedIcon, PositionedPath } from '../core/types.ts';
import { type Attrs } from './xml.ts';
/** Comandos normalizados → `d` do SVG. */
export declare const svgPathData: (commands: readonly PathCommand[]) => string;
export interface VectorStroke {
    readonly fill?: string;
    readonly stroke?: string;
    readonly strokeWidth: number;
    readonly lineCap?: LineCap;
    readonly lineJoin?: LineJoin;
    readonly dash?: string;
}
export declare const vectorAttrs: (paint: VectorStroke) => Attrs;
/** Sombra da própria forma (o PPTX põe o efeito no shape, não numa caixa). */
export declare const withShadow: (css: CssStyle, index: number, body: string) => string;
export declare const pathSvg: (node: PositionedPath, index: number) => string;
/** Ícone: os mesmos traços do emissor (viewBox centrado, traço × escala) ou o mesmo PNG. */
export declare const iconSvg: (node: PositionedIcon, index: number) => string;
