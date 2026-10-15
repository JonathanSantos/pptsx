import type { BorderSide, BorderStyle, CssStyle, PositionedNode, Rect, ShapeKind } from '../core/types.ts';
import {
  boxShapeOf,
  hasBackgroundImage,
  hasBoxDecoration,
  insetRadiusOf,
  insetRect,
  sideSegmentOf,
  uniformBorderOf,
  visibleSidesOf,
} from '../emit/decoration.ts';
import { cornerRadiusOf, imageElementSvg, kindSvg, rectAttrs } from './svg.ts';
import { element, type Attrs } from './xml.ts';

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

export const shadowFilterSvg = (css: CssStyle, id: string): string => {
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

/** Rect (com o raio do CSS) ou, num Box com `shape`, a geometria da kind (M12). */
const boxPartSvg = (kind: ShapeKind, rect: Rect, radius: number | undefined, attrs: Attrs, part: 'fill' | 'stroke'): string =>
  kind === 'rect' ? element('rect', { ...rectAttrs(rect), ...radiusAttrs(radius, rect), ...attrs }) : kindSvg(kind, rect, attrs, part);

const backgroundSvg = (css: CssStyle, frame: Rect, filterId: string, kind: ShapeKind): string => {
  const fill = css.backgroundColor === undefined || css.backgroundAlpha === 0 ? 'none' : css.backgroundColor;
  if (fill === 'none' && css.boxShadow === undefined) return '';
  return boxPartSvg(kind, frame, css.borderRadius, {
    fill,
    'fill-opacity': css.backgroundAlpha === 1 ? undefined : css.backgroundAlpha,
    filter: css.boxShadow === undefined ? undefined : `url(#${filterId})`,
  }, 'fill');
};

const bordersSvg = (css: CssStyle, frame: Rect, kind: ShapeKind): string => {
  const uniform = uniformBorderOf(css);
  if (uniform !== undefined) {
    const inner = insetRect(frame, uniform.width / 2);
    return boxPartSvg(kind, inner, insetRadiusOf(css.borderRadius, uniform), { fill: 'none', ...strokeAttrs(uniform) }, 'stroke');
  }
  // Bordas por lado só existem no retângulo (numa forma, o fit avisa com css-not-emitted).
  if (kind !== 'rect') return '';
  return visibleSidesOf(css)
    .map((side) => sideLineSvg(sideSegmentOf(frame, side, css.border[side].width), css.border[side]))
    .join('');
};

const outlineSvg = (css: CssStyle, frame: Rect, kind: ShapeKind): string =>
  css.outline === undefined
    ? ''
    : boxPartSvg(kind, frame, css.borderRadius, { fill: 'none', stroke: css.outline.color, 'stroke-width': css.outline.width }, 'stroke');

/** Sombra, fundo, imagem de fundo (cover), bordas e contorno, nessa ordem (a do emissor). */
export const decorationSvg = (node: PositionedNode, loadImage: (src: string) => string, index: number): string => {
  if (!hasBoxDecoration(node)) return '';
  const { css, frame } = node;
  const filterId = `shadow-${index}`;
  const src = hasBackgroundImage(node) ? css.backgroundImage : undefined;
  const image = src === undefined ? '' : imageElementSvg(frame, loadImage(src), 'cover', `bg-${index}`);
  const kind = boxShapeOf(node);
  return shadowFilterSvg(css, filterId) + backgroundSvg(css, frame, filterId, kind) + image + bordersSvg(css, frame, kind) + outlineSvg(css, frame, kind);
};
