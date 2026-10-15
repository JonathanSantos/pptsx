import { DEFAULTS } from '../core/defaults.ts';
import type { PositionedConnector } from '../core/types.ts';
import { arrowHeadSvg, arrowInsetOf, dashArrayOf, insetPoint } from './arrows.ts';
import { rectAttrs, textSvg, type TextSvgOptions } from './svg.ts';
import { element } from './xml.ts';

/**
 * Conector no preview (M12-5): polilinha recuada onde há ponta cheia, pontas como polígonos
 * (nunca `<marker>`) e o rótulo com fundo. Mesmas regras do emissor (src/emit/connector.ts).
 */

const fmt = (value: number): string => String(Math.round(value * 1000) / 1000);

export const connectorSvg = (connector: PositionedConnector, options: TextSvgOptions = {}): string => {
  const { props, points } = connector;
  const color = props.stroke ?? DEFAULTS.connector.stroke;
  const width = props.strokeWidth ?? DEFAULTS.connector.strokeWidth;
  const startArrow = props.startArrow ?? DEFAULTS.connector.startArrow;
  const endArrow = props.endArrow ?? DEFAULTS.connector.endArrow;
  const first = points[0]!;
  const second = points[1]!;
  const last = points.at(-1)!;
  const beforeLast = points.at(-2)!;
  const drawn = [
    insetPoint(first, second, arrowInsetOf(startArrow, width)),
    ...points.slice(1, -1),
    insetPoint(last, beforeLast, arrowInsetOf(endArrow, width)),
  ];
  const line = element('polyline', {
    points: drawn.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' '),
    fill: 'none',
    stroke: color,
    'stroke-width': width,
    'stroke-dasharray': dashArrayOf(props.lineStyle, width),
    'stroke-linejoin': 'miter',
  });
  const heads = arrowHeadSvg(startArrow, first, second, width, color) + arrowHeadSvg(endArrow, last, beforeLast, width, color);
  const { label } = connector;
  if (label === undefined) return line + heads;
  const background = label.background === undefined ? '' : element('rect', { ...rectAttrs(label.frame), fill: label.background });
  return line + heads + background + textSvg(label.text, options);
};
