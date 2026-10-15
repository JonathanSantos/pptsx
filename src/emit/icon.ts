import { Resvg } from '@resvg/resvg-js';
import { DEFAULTS } from '../core/defaults.ts';
import type { PositionedIcon, Rect, VectorPath } from '../core/types.ts';
import { customShapeOf, placeCommands, strokeScaleOf, viewBoxTransformOf } from './vector.ts';
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

export const iconShapesOf = (node: PositionedIcon): readonly IconShape[] => {
  if (!('paths' in node.content)) return [];
  const scale = strokeScaleOf(node.viewBox, node.frame, 'meet');
  return node.content.paths.map((path) => ({
    path,
    spec: customShapeOf(placeCommands(path.commands, node.viewBox, node.frame, 'meet'), node.frame, {
      fill: path.fill,
      stroke: path.stroke,
      strokeWidth: path.strokeWidth === undefined ? undefined : path.strokeWidth * scale,
    }),
  }));
};

/** Retângulo que o desenho ocupa no frame (`xMidYMid meet`). */
export const iconDrawnRectOf = (node: PositionedIcon): Rect => {
  const { sx, dx, dy } = viewBoxTransformOf(node.viewBox, node.frame, 'meet');
  const { x, y, width, height } = node.viewBox;
  return { x: x * sx + dx, y: y * sx + dy, width: width * sx, height: height * sx };
};

/** px do PNG: a largura desenhada (pt → px a 96 dpi) × rasterScale, para ficar nítido. */
export const iconRasterWidthOf = (node: PositionedIcon): number =>
  Math.max(1, Math.round(iconDrawnRectOf(node).width * DEFAULTS.icon.pxPerPt * DEFAULTS.icon.rasterScale));

/** PNG do ícone raster (IO-free: só CPU); undefined quando o ícone é vetor. */
export const iconPngOf = (node: PositionedIcon): Buffer | undefined => {
  if (!('raster' in node.content)) return undefined;
  const resvg = new Resvg(node.content.svg, { fitTo: { mode: 'width', value: iconRasterWidthOf(node) }, font: { loadSystemFonts: false } });
  return resvg.render().asPng();
};
