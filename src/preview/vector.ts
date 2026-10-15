import { DEFAULTS, pathPaintOf } from '../core/defaults.ts';
import type { CssStyle, LineCap, LineJoin, PathCommand, PositionedIcon, PositionedPath } from '../core/types.ts';
import { iconDrawnRectOf, iconPngOf } from '../emit/icon.ts';
import { placeCommands, strokeScaleOf } from '../emit/vector.ts';
import { dashArrayOf } from './arrows.ts';
import { shadowFilterSvg } from './decoration.ts';
import { dataUriOf } from './image.ts';
import { rectAttrs } from './svg.ts';
import { element, type Attrs } from './xml.ts';

/**
 * Path e ícone vetorial no preview (M12): os mesmos comandos que o emissor põe no custGeom, já
 * escalados para o frame (o traço não escala), com sombra própria no lugar da caixa.
 */

const fmt = (value: number): string => String(Math.round(value * 1000) / 1000);

/** Comandos normalizados → `d` do SVG. */
export const svgPathData = (commands: readonly PathCommand[]): string =>
  commands
    .map((command) => {
      switch (command.op) {
        case 'Z':
          return 'Z';
        case 'C':
          return `C${fmt(command.x1)} ${fmt(command.y1)} ${fmt(command.x2)} ${fmt(command.y2)} ${fmt(command.x)} ${fmt(command.y)}`;
        case 'Q':
          return `Q${fmt(command.x1)} ${fmt(command.y1)} ${fmt(command.x)} ${fmt(command.y)}`;
        default:
          return `${command.op}${fmt(command.x)} ${fmt(command.y)}`;
      }
    })
    .join(' ');

const CAPS: Readonly<Record<LineCap, string>> = { flat: 'butt', round: 'round' };

export interface VectorStroke {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth: number;
  readonly lineCap?: LineCap;
  readonly lineJoin?: LineJoin;
  readonly dash?: string;
}

export const vectorAttrs = (paint: VectorStroke): Attrs => ({
  fill: paint.fill ?? 'none',
  stroke: paint.stroke ?? 'none',
  'stroke-width': paint.stroke === undefined ? undefined : paint.strokeWidth,
  'stroke-linecap': paint.stroke === undefined || paint.lineCap === undefined ? undefined : CAPS[paint.lineCap],
  'stroke-linejoin': paint.stroke === undefined || paint.lineJoin === undefined ? undefined : paint.lineJoin,
  'stroke-dasharray': paint.dash,
});

/** Sombra da própria forma (o PPTX põe o efeito no shape, não numa caixa). */
export const withShadow = (css: CssStyle, index: number, body: string): string => {
  if (css.boxShadow === undefined || body === '') return body;
  const id = `shadow-${index}`;
  return shadowFilterSvg(css, id) + element('g', { filter: `url(#${id})` }, body);
};

export const pathSvg = (node: PositionedPath, index: number): string => {
  if (node.commands.length === 0) return '';
  const { props } = node;
  const width = props.strokeWidth ?? DEFAULTS.strokeWidth;
  const d = svgPathData(placeCommands(node.commands, node.viewBox, node.frame, 'stretch'));
  const paint = pathPaintOf(props);
  const attrs = vectorAttrs({
    ...paint,
    strokeWidth: width,
    lineCap: props.lineCap,
    lineJoin: props.lineJoin,
    dash: dashArrayOf(props.lineStyle, width, props.lineCap === 'round'),
  });
  return withShadow(node.css, index, element('path', { d, ...attrs }));
};

/** Ícone: os mesmos traços do emissor (viewBox centrado, traço × escala) ou o mesmo PNG. */
export const iconSvg = (node: PositionedIcon, index: number): string => {
  const png = iconPngOf(node);
  if (png !== undefined) return element('image', { ...rectAttrs(iconDrawnRectOf(node)), href: dataUriOf('image/png', png), preserveAspectRatio: 'none' });
  if (!('paths' in node.content)) return '';
  const scale = strokeScaleOf(node.viewBox, node.frame, 'meet');
  const body = node.content.paths
    .map((path) =>
      element('path', {
        d: svgPathData(placeCommands(path.commands, node.viewBox, node.frame, 'meet')),
        ...vectorAttrs({
          fill: path.fill,
          stroke: path.stroke,
          strokeWidth: (path.strokeWidth ?? DEFAULTS.strokeWidth) * scale,
          lineCap: path.lineCap,
          lineJoin: path.lineJoin,
        }),
      }),
    )
    .join('');
  return withShadow(node.css, index, body);
};
