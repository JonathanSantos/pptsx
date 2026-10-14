import type { BorderSide, BorderStyle, CssStyle, PositionedNode, Rect } from '../core/types.ts';
import {
  hasBackgroundImage,
  insetRadiusOf,
  insetRect,
  sideSegmentOf,
  uniformBorderOf,
  visibleSidesOf,
} from '../emit/decoration.ts';
import { cornerRadiusOf, imageElementSvg, rectAttrs } from './svg.ts';
import { element } from './xml.ts';

/**
 * Pintura CSS da caixa em SVG (M11): as mesmas decisões de src/emit/decoration.ts (fundo,
 * sombra, imagem de fundo, borda uniforme recuada, bordas por lado, contorno), para o preview
 * bater com o .pptx. Opacidade e rotação herdadas ficam no <g> do item (slide.ts).
 */

const DASHES: Readonly<Record<BorderStyle, string | undefined>> = {
  solid: undefined,
  dashed: '4 2',
  dotted: '1 1.5',
  none: undefined,
};

/** O desvio-padrão do SVG é metade do blur do CSS. */
const BLUR_TO_STD_DEVIATION = 0.5;
/** Área do filtro com folga para a sombra não ser cortada. */
const FILTER_REGION = { x: '-50%', y: '-50%', width: '200%', height: '200%' } as const;

const strokeAttrs = (side: BorderSide) => ({
  stroke: side.color,
  'stroke-width': side.width,
  'stroke-opacity': side.alpha === 1 ? undefined : side.alpha,
  'stroke-dasharray': DASHES[side.style],
});

const shadowFilter = (css: CssStyle, id: string): string => {
  const shadow = css.boxShadow;
  if (shadow === undefined) return '';
  const drop = element('feDropShadow', {
    dx: shadow.x,
    dy: shadow.y,
    stdDeviation: shadow.blur * BLUR_TO_STD_DEVIATION,
    'flood-color': shadow.color,
    'flood-opacity': shadow.alpha,
  });
  return element('defs', {}, element('filter', { id, ...FILTER_REGION }, drop));
};

const radiusAttrs = (radius: number | undefined, rect: Rect) => {
  if (radius === undefined || radius <= 0) return {};
  const r = cornerRadiusOf(radius, rect);
  return { rx: r, ry: r };
};

const sideLineSvg = (segment: Rect, border: BorderSide): string =>
  element('line', {
    x1: segment.x,
    y1: segment.y,
    x2: segment.x + segment.width,
    y2: segment.y + segment.height,
    ...strokeAttrs(border),
  });

const backgroundSvg = (css: CssStyle, frame: Rect, filterId: string): string => {
  const fill = css.backgroundColor === undefined || css.backgroundAlpha === 0 ? 'none' : css.backgroundColor;
  if (fill === 'none' && css.boxShadow === undefined) return '';
  return element('rect', {
    ...rectAttrs(frame),
    ...radiusAttrs(css.borderRadius, frame),
    fill,
    'fill-opacity': css.backgroundAlpha === 1 ? undefined : css.backgroundAlpha,
    filter: css.boxShadow === undefined ? undefined : `url(#${filterId})`,
  });
};

const bordersSvg = (css: CssStyle, frame: Rect): string => {
  const uniform = uniformBorderOf(css);
  if (uniform !== undefined) {
    const inner = insetRect(frame, uniform.width / 2);
    return element('rect', { ...rectAttrs(inner), ...radiusAttrs(insetRadiusOf(css.borderRadius, uniform), frame), fill: 'none', ...strokeAttrs(uniform) });
  }
  return visibleSidesOf(css)
    .map((side) => sideLineSvg(sideSegmentOf(frame, side, css.border[side].width), css.border[side]))
    .join('');
};

const outlineSvg = (css: CssStyle, frame: Rect): string =>
  css.outline === undefined
    ? ''
    : element('rect', { ...rectAttrs(frame), ...radiusAttrs(css.borderRadius, frame), fill: 'none', stroke: css.outline.color, 'stroke-width': css.outline.width });

/** Sombra, fundo, imagem de fundo (cover), bordas e contorno, nessa ordem (a do emissor). */
export const decorationSvg = (node: PositionedNode, loadImage: (src: string) => string, index: number): string => {
  const { css, frame } = node;
  const filterId = `shadow-${index}`;
  const src = hasBackgroundImage(node) ? css.backgroundImage : undefined;
  const image = src === undefined ? '' : imageElementSvg(frame, loadImage(src), 'cover', `bg-${index}`);
  return shadowFilter(css, filterId) + backgroundSvg(css, frame, filterId) + image + bordersSvg(css, frame) + outlineSvg(css, frame);
};
