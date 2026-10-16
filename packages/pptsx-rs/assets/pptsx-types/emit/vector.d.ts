import type { LineCap, LineJoin, LineStyle, PathCommand, PositionedPath, Rect } from '../core/types.ts';
import { type ShapeSpec } from './options.ts';
import type * as Pptx from './pptx.ts';
/**
 * Geometria livre (M12): comandos normalizados → coordenadas do slide → `custGeom` do pptxgenjs.
 * Puro. O Path estica o viewBox até o frame (como a geometria de uma forma); o ícone mantém a
 * proporção, centrado (`xMidYMid meet`, como o SVG). O preview usa o mesmo `placeCommands`.
 */
export type ViewBoxFit = 'stretch' | 'meet';
interface Transform {
    readonly sx: number;
    readonly sy: number;
    readonly dx: number;
    readonly dy: number;
}
/** viewBox → frame. Eixo de tamanho 0 no viewBox não escala (uma linha reta continua reta). */
export declare const viewBoxTransformOf: (viewBox: Rect, frame: Rect, fit: ViewBoxFit) => Transform;
/** Comandos em coordenadas do slide (pt). */
export declare const placeCommands: (commands: readonly PathCommand[], viewBox: Rect, frame: Rect, fit: ViewBoxFit) => readonly PathCommand[];
/** Escala uniforme do viewBox (traço de ícone em unidades do SVG → pt). */
export declare const strokeScaleOf: (viewBox: Rect, frame: Rect, fit: ViewBoxFit) => number;
type CustomPoint = NonNullable<Pptx.ShapeProps['points']>[number];
/** Comandos (slide, pt) → `points` do custGeom relativos ao frame. */
export declare const customPointsOf: (commands: readonly PathCommand[], frame: Rect) => CustomPoint[];
export interface VectorPaint {
    readonly fill?: string;
    readonly stroke?: string;
    /** pt (já escalado no ícone). */
    readonly strokeWidth?: number;
    readonly lineStyle?: LineStyle;
    readonly lineCap?: LineCap;
    readonly lineJoin?: LineJoin;
}
/** Um custGeom com o frame do nó e os comandos já no slide. */
export declare const customShapeOf: (commands: readonly PathCommand[], frame: Rect, paint: VectorPaint) => ShapeSpec;
/** Path do autor: pintura efetiva (sem fill nem stroke → fill preto) e viewBox esticado. */
export declare const pathOf: (node: PositionedPath) => ShapeSpec | undefined;
export {};
