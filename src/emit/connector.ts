import { DEFAULTS } from '../core/defaults.ts';
import type { ArrowType, PathCommand, PositionedConnector, Rect } from '../core/types.ts';
import { dashOf } from './line-style.ts';
import { hexOf, positionOf, textOf, type ShapeSpec, type TextSpec } from './options.ts';
import type * as Pptx from './pptx.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import type { LineBreaks } from '../core/types.ts';
import { customPointsOf } from './vector.ts';

/**
 * Conectores (M12-5) → pptxgenjs. Puro. Reta = shape `line` (o PPTX desenha da quina sup. esq. à
 * inf. dir.; flipH/flipV dão a direção, e as pontas seguem: headEnd no início, tailEnd no fim).
 * Cotovelo = custGeom aberto, sem fill. Rótulo = fundo opcional + caixa de texto.
 */

const arrowsOf = (start: ArrowType, end: ArrowType): Pick<Pptx.ShapeLineProps, 'beginArrowType' | 'endArrowType'> => ({
  ...(start === 'none' ? {} : { beginArrowType: start }),
  ...(end === 'none' ? {} : { endArrowType: end }),
});

const lineOf = (connector: PositionedConnector): Pptx.ShapeLineProps => {
  const { props } = connector;
  return {
    color: hexOf(props.stroke ?? DEFAULTS.connector.stroke),
    width: props.strokeWidth ?? DEFAULTS.connector.strokeWidth,
    ...dashOf(props.lineStyle),
    ...arrowsOf(props.startArrow ?? DEFAULTS.connector.startArrow, props.endArrow ?? DEFAULTS.connector.endArrow),
  };
};

export const boundsOfPoints = (points: PositionedConnector['points']): Rect => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const straightOf = (connector: PositionedConnector): ShapeSpec => {
  const [start, end] = connector.points as readonly [PositionedConnector['points'][number], PositionedConnector['points'][number]];
  return {
    shape: 'line',
    options: {
      ...positionOf(boundsOfPoints(connector.points)),
      line: lineOf(connector),
      ...(end.x < start.x ? { flipH: true } : {}),
      ...(end.y < start.y ? { flipV: true } : {}),
    },
  };
};

const polylineOf = (connector: PositionedConnector): ShapeSpec => {
  const frame = boundsOfPoints(connector.points);
  const commands: readonly PathCommand[] = connector.points.map((point, index) => ({ op: index === 0 ? 'M' : 'L', x: point.x, y: point.y }));
  return { shape: 'custGeom' as Pptx.ShapeName, options: { ...positionOf(frame), points: customPointsOf(commands, frame), line: lineOf(connector) } };
};

/** A linha (ou polilinha) do conector; 2 pontos sempre saem como `line`. */
export const connectorShapeOf = (connector: PositionedConnector): ShapeSpec =>
  connector.points.length === 2 ? straightOf(connector) : polylineOf(connector);

export interface ConnectorLabelSpec {
  readonly background?: ShapeSpec;
  readonly text: TextSpec;
}

export const connectorLabelOf = (
  connector: PositionedConnector,
  lineSpacing?: LineSpacingStrategy,
  lang?: string,
  lineBreaks?: LineBreaks,
): ConnectorLabelSpec | undefined => {
  const { label } = connector;
  if (label === undefined) return undefined;
  const background: ShapeSpec | undefined =
    label.background === undefined ? undefined : { shape: 'rect', options: { ...positionOf(label.frame), fill: { type: 'solid', color: hexOf(label.background) } } };
  return { ...(background === undefined ? {} : { background }), text: textOf(label.text, lineSpacing, lang, lineBreaks) };
};
