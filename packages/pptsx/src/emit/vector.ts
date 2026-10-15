import { DEFAULTS, pathPaintOf } from '../core/defaults.ts';
import type { LineCap, LineJoin, LineStyle, PathCommand, PositionedPath, Rect } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { dashOf } from './line-style.ts';
import { hexOf, positionOf, type ShapeSpec } from './options.ts';
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
export const viewBoxTransformOf = (viewBox: Rect, frame: Rect, fit: ViewBoxFit): Transform => {
  const sx = viewBox.width > 0 ? frame.width / viewBox.width : 1;
  const sy = viewBox.height > 0 ? frame.height / viewBox.height : 1;
  if (fit === 'stretch') return { sx, sy, dx: frame.x - viewBox.x * sx, dy: frame.y - viewBox.y * sy };
  const scale = Math.min(viewBox.width > 0 ? sx : sy, viewBox.height > 0 ? sy : sx);
  const dx = frame.x + (frame.width - viewBox.width * scale) / 2 - viewBox.x * scale;
  const dy = frame.y + (frame.height - viewBox.height * scale) / 2 - viewBox.y * scale;
  return { sx: scale, sy: scale, dx, dy };
};

const mapX = (t: Transform, x: number): number => x * t.sx + t.dx;
const mapY = (t: Transform, y: number): number => y * t.sy + t.dy;

const mapCommand = (t: Transform, command: PathCommand): PathCommand => {
  switch (command.op) {
    case 'Z':
      return command;
    case 'C':
      return { op: 'C', x1: mapX(t, command.x1), y1: mapY(t, command.y1), x2: mapX(t, command.x2), y2: mapY(t, command.y2), x: mapX(t, command.x), y: mapY(t, command.y) };
    case 'Q':
      return { op: 'Q', x1: mapX(t, command.x1), y1: mapY(t, command.y1), x: mapX(t, command.x), y: mapY(t, command.y) };
    default:
      return { op: command.op, x: mapX(t, command.x), y: mapY(t, command.y) };
  }
};

/** Comandos em coordenadas do slide (pt). */
export const placeCommands = (commands: readonly PathCommand[], viewBox: Rect, frame: Rect, fit: ViewBoxFit): readonly PathCommand[] => {
  const transform = viewBoxTransformOf(viewBox, frame, fit);
  return commands.map((command) => mapCommand(transform, command));
};

/** Escala uniforme do viewBox (traço de ícone em unidades do SVG → pt). */
export const strokeScaleOf = (viewBox: Rect, frame: Rect, fit: ViewBoxFit): number => {
  const { sx, sy } = viewBoxTransformOf(viewBox, frame, fit);
  return fit === 'meet' ? sx : Math.sqrt(Math.abs(sx * sy));
};

type CustomPoint = NonNullable<Pptx.ShapeProps['points']>[number];

/** Polegadas relativas ao canto do frame (o `<a:path>` do pptxgenjs tem o tamanho do shape). */
const inches = (value: number, origin: number): number => ptToInches(value - origin);

/** Comandos (slide, pt) → `points` do custGeom relativos ao frame. */
export const customPointsOf = (commands: readonly PathCommand[], frame: Rect): CustomPoint[] => {
  const x = (value: number) => inches(value, frame.x);
  const y = (value: number) => inches(value, frame.y);
  return commands.map((command): CustomPoint => {
    switch (command.op) {
      case 'Z':
        return { close: true };
      case 'M':
        return { x: x(command.x), y: y(command.y), moveTo: true };
      case 'L':
        return { x: x(command.x), y: y(command.y) };
      case 'C':
        return { x: x(command.x), y: y(command.y), curve: { type: 'cubic', x1: x(command.x1), y1: y(command.y1), x2: x(command.x2), y2: y(command.y2) } };
      case 'Q':
        return { x: x(command.x), y: y(command.y), curve: { type: 'quadratic', x1: x(command.x1), y1: y(command.y1) } };
    }
  });
};

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
export const customShapeOf = (commands: readonly PathCommand[], frame: Rect, paint: VectorPaint): ShapeSpec => ({
  shape: 'custGeom' as Pptx.ShapeName,
  options: {
    ...positionOf(frame),
    points: customPointsOf(commands, frame),
    ...(paint.fill === undefined ? {} : { fill: { type: 'solid', color: hexOf(paint.fill) } }),
    ...(paint.stroke === undefined
      ? {}
      : { line: { color: hexOf(paint.stroke), width: paint.strokeWidth ?? DEFAULTS.strokeWidth, ...dashOf(paint.lineStyle) } }),
  },
});

/** Path do autor: pintura efetiva (sem fill nem stroke → fill preto) e viewBox esticado. */
export const pathOf = (node: PositionedPath): ShapeSpec | undefined => {
  if (node.commands.length === 0) return undefined;
  const commands = placeCommands(node.commands, node.viewBox, node.frame, 'stretch');
  const { props } = node;
  return customShapeOf(commands, node.frame, { ...pathPaintOf(props), strokeWidth: props.strokeWidth, lineStyle: props.lineStyle });
};
