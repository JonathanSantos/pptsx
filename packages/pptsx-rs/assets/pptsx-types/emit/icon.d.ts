import type { PositionedIcon, Rect, VectorPath } from '../core/types.ts';
import type { ShapeSpec } from './options.ts';
/**
 * Icon (M12-4): vetor = um custGeom por traço, todos com o frame do ícone (o viewBox centrado,
 * escala uniforme); raster = PNG do resvg na largura final × rasterScale, na área que o desenho
 * ocupa dentro do frame. O preview usa as mesmas funções.
 */
export interface IconShape {
    readonly spec: ShapeSpec;
    readonly path: VectorPath;
}
export declare const iconShapesOf: (node: PositionedIcon) => readonly IconShape[];
/** Retângulo que o desenho ocupa no frame (`xMidYMid meet`). */
export declare const iconDrawnRectOf: (node: PositionedIcon) => Rect;
/** px do PNG: a largura desenhada (pt → px a 96 dpi) × rasterScale, para ficar nítido. */
export declare const iconRasterWidthOf: (node: PositionedIcon) => number;
/** PNG do ícone raster (IO-free: só CPU); undefined quando o ícone é vetor. */
export declare const iconPngOf: (node: PositionedIcon) => Buffer | undefined;
