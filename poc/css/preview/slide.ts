import { dispatch, type DispatchTable } from '../../../src/core/dispatch.ts';
import type { Rect, SlideSize } from '../../../src/core/types.ts';
import { chartSvg } from '../../../src/preview/chart.ts';
import { loadImageUri } from '../../../src/preview/image.ts';
import {
  backgroundColorSvg,
  cornerRadiusOf,
  debugOutlineSvg,
  imageElementSvg,
  imageSvg,
  shapeSvg,
  textOverflowRectOf,
  textOverflowSvg,
} from '../../../src/preview/svg.ts';
import { tableSvg } from '../../../src/preview/table.ts';
import { attrs, element } from '../../../src/preview/xml.ts';
import { uniformBorderOf } from '../emit/decoration.ts';
import { cssTextSvg } from './text.ts';
import { contentRectOf } from '../layout/index.ts';
import { paintOrderOf, type PaintItem } from '../paint.ts';
import type { BorderSide, CssStyle, PositionedNode, PositionedSlide, Side } from '../types.ts';

/**
 * Preview SVG da PoC: os desenhos de src/preview na ordem de pintura CSS, com a mesma
 * pintura nova do emissor (fundo, bordas por lado, sombra, opacity, rotate). O preview é do
 * .pptx: o que não sai no arquivo (css-not-emitted) também não é desenhado.
 */

export interface SvgOptions {
  readonly widthPx: number;
  readonly debug?: boolean;
  readonly baseDir: string;
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  readonly readFile?: (path: string) => Buffer;
}

interface DrawContext {
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  readonly loadImage: (src: string) => string;
}

const DASHES: Readonly<Record<BorderSide['style'], string | undefined>> = {
  solid: undefined,
  dashed: '4 2',
  dotted: '1 1.5',
  none: undefined,
};

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

const rectAttrs = (r: Rect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });

const inset = (frame: Rect, amount: number): Rect => ({
  x: frame.x + amount,
  y: frame.y + amount,
  width: Math.max(0, frame.width - 2 * amount),
  height: Math.max(0, frame.height - 2 * amount),
});

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
    stdDeviation: shadow.blur / 2,
    'flood-color': shadow.color,
    'flood-opacity': shadow.alpha,
  });
  return element('defs', {}, element('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }, drop));
};

const radiusAttrs = (radius: number | undefined, rect: Rect) => {
  if (radius === undefined || radius <= 0) return {};
  const r = cornerRadiusOf(radius, rect);
  return { rx: r, ry: r };
};

const sideLineSvg = (frame: Rect, side: Side, border: BorderSide): string => {
  const half = border.width / 2;
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const lines: Readonly<Record<Side, readonly [number, number, number, number]>> = {
    top: [frame.x, frame.y + half, right, frame.y + half],
    bottom: [frame.x, bottom - half, right, bottom - half],
    left: [frame.x + half, frame.y, frame.x + half, bottom],
    right: [right - half, frame.y, right - half, bottom],
  };
  const [x1, y1, x2, y2] = lines[side];
  return element('line', { x1, y1, x2, y2, ...strokeAttrs(border) });
};

/** Mesmas decisões de emit/decoration.ts, em SVG. */
const decorationSvg = (node: PositionedNode, ctx: DrawContext, index: number): string => {
  const { css, frame } = node;
  const filterId = `shadow-${index}`;
  const filter = css.boxShadow === undefined ? {} : { filter: `url(#${filterId})` };
  const fill = css.backgroundColor === undefined || css.backgroundAlpha === 0 ? 'none' : css.backgroundColor;
  const fillOpacity = css.backgroundAlpha === 1 ? undefined : css.backgroundAlpha;
  const uniform = uniformBorderOf(css);
  const hasImage = css.backgroundImage !== undefined && node.kind !== 'image';
  const background =
    fill === 'none' && css.boxShadow === undefined
      ? ''
      : element('rect', { ...rectAttrs(frame), ...radiusAttrs(css.borderRadius, frame), fill, 'fill-opacity': fillOpacity, ...filter });
  const image = hasImage ? imageElementSvg(frame, ctx.loadImage(css.backgroundImage!), 'cover', `bg-${index}`) : '';
  const borders =
    uniform !== undefined
      ? element('rect', { ...rectAttrs(inset(frame, uniform.width / 2)), ...radiusAttrs(css.borderRadius === undefined ? undefined : Math.max(0, css.borderRadius - uniform.width / 2), frame), fill: 'none', ...strokeAttrs(uniform) })
      : SIDES.filter((side) => css.border[side].width > 0 && css.border[side].style !== 'none').map((side) => sideLineSvg(frame, side, css.border[side])).join('');
  const outline =
    css.outline === undefined
      ? ''
      : element('rect', { ...rectAttrs(frame), ...radiusAttrs(css.borderRadius, frame), fill: 'none', stroke: css.outline.color, 'stroke-width': css.outline.width });
  return shadowFilter(css, filterId) + background + image + borders + outline;
};

const contentOf = <N extends PositionedNode>(node: N): N => ({ ...node, frame: contentRectOf(node.frame, node.box) });

const drawers: DispatchTable<PositionedNode, string, [ctx: DrawContext, index: number]> = {
  box: () => '',
  text: (node, ctx) => cssTextSvg(contentOf(node), { fontFamilyMap: ctx.fontFamilyMap }),
  image: (node, ctx, index) => imageSvg(contentOf(node), ctx.loadImage(node.props.src), `clip-${index}`),
  shape: (node) => shapeSvg(node),
  chart: (node, ctx) => chartSvg(contentOf(node), { fontFamilyMap: ctx.fontFamilyMap }),
  table: (node, ctx, index) => tableSvg(contentOf(node), { fontFamilyMap: ctx.fontFamilyMap }, `clip-${index}`),
};

const transformOf = (item: PaintItem): string | undefined =>
  item.rotations.length === 0 ? undefined : item.rotations.map((r) => `rotate(${r.degrees} ${r.cx} ${r.cy})`).join(' ');

const drawItem = (item: PaintItem, ctx: DrawContext): string => {
  const body = decorationSvg(item.node, ctx, item.index) + dispatch(drawers, item.node, ctx, item.index);
  const transform = transformOf(item);
  if (transform === undefined && item.opacity === 1) return body;
  return element('g', { transform, opacity: item.opacity === 1 ? undefined : item.opacity }, body);
};

const DEFAULT_BACKGROUND = '#FFFFFF';

const backgroundSvg = (slide: PositionedSlide, area: Rect, ctx: DrawContext): string => {
  const { background } = slide.props;
  const base = backgroundColorSvg(area, typeof background === 'string' ? background : DEFAULT_BACKGROUND);
  if (background === undefined || typeof background === 'string') return base;
  return base + imageElementSvg(area, ctx.loadImage(background.image), 'cover', 'clip-background');
};

const debugSvg = (items: readonly PaintItem[]): string =>
  items
    .filter((item) => item.node.kind !== 'shape')
    .map(({ node }) => {
      const band = node.kind === 'text' ? textOverflowRectOf(contentOf(node)) : undefined;
      return band === undefined ? debugOutlineSvg(node.frame) : textOverflowSvg(node.frame, band);
    })
    .join('');

export const slideToSvg = (slide: PositionedSlide, size: SlideSize, options: SvgOptions): string => {
  const ctx: DrawContext = {
    fontFamilyMap: options.fontFamilyMap,
    loadImage: (src) => loadImageUri(src, options.baseDir, options.readFile),
  };
  const items = paintOrderOf(slide);
  const area: Rect = { x: 0, y: 0, width: size.width, height: size.height };
  const body = [backgroundSvg(slide, area, ctx), ...items.map((item) => drawItem(item, ctx)), options.debug ? debugSvg(items) : ''].join('');
  const root = attrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${size.width} ${size.height}`,
    width: options.widthPx,
    height: Math.round((options.widthPx * size.height) / size.width),
  });
  return `<svg${root}>${body}</svg>`;
};
