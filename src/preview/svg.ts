import { DEFAULTS, imageFitOf, strokeColorOf, textStyleOf } from '../core/defaults.ts';
import type {
  Color,
  ImageFit,
  PositionedBox,
  PositionedImage,
  PositionedShape,
  PositionedText,
  Pt,
  Rect,
  ShapeKind,
  StrokeProps,
  TextAlign,
} from '../core/types.ts';
import { element, escapeXml, type Attrs } from './xml.ts';

/**
 * Builders puros: nó posicionado → string SVG. Regras visuais espelham
 * src/emit/options.ts para o preview bater com o .pptx.
 */

/** Contorno de debug igual ao do emit: vermelho, 0.5 pt, tracejado. */
const DEBUG_OUTLINE = { color: '#FF0000', width: 0.5, dash: '2 1.5' } as const;
const DEBUG_OVERFLOW = { color: '#FF0000', opacity: 0.3 } as const;

/** roundRect sem radius no pptx usa a geometria padrão do preset (adj 16667 = 16,667% do menor lado). */
const PPTX_DEFAULT_ROUND_RATIO = 0.16667;

/** Diferenças menores que isso são ruído de ponto flutuante do layout. */
const OVERFLOW_EPSILON = 0.01;

const rectAttrs = (frame: Rect): Attrs => ({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });

const paintAttrs = (props: StrokeProps): Attrs => ({
  fill: props.fill ?? 'none',
  stroke: props.stroke ?? 'none',
  'stroke-width': props.stroke === undefined ? undefined : (props.strokeWidth ?? DEFAULTS.strokeWidth),
});

/** Mesmo limite do emit: raio no máximo metade do menor lado. */
export const cornerRadiusOf = (radius: Pt | undefined, frame: Rect): Pt => {
  const maxRadius = Math.min(frame.width, frame.height) / 2;
  if (radius === undefined) return Math.min(frame.width, frame.height) * PPTX_DEFAULT_ROUND_RATIO;
  return Math.min(Math.max(radius, 0), maxRadius);
};

type ShapeBuilder = (frame: Rect, props: StrokeProps & { readonly radius?: Pt }) => string;

const shapeBuilders: Readonly<Record<ShapeKind, ShapeBuilder>> = {
  rect: (frame, props) => element('rect', { ...rectAttrs(frame), ...paintAttrs(props) }),
  roundRect: (frame, props) => {
    const r = cornerRadiusOf(props.radius, frame);
    return element('rect', { ...rectAttrs(frame), rx: r, ry: r, ...paintAttrs(props) });
  },
  ellipse: (frame, props) =>
    element('ellipse', {
      cx: frame.x + frame.width / 2,
      cy: frame.y + frame.height / 2,
      rx: frame.width / 2,
      ry: frame.height / 2,
      ...paintAttrs(props),
    }),
  line: (frame, props) =>
    element('line', {
      x1: frame.x,
      y1: frame.y,
      x2: frame.x + frame.width,
      y2: frame.y + frame.height,
      stroke: props.stroke ?? DEFAULTS.lineStroke,
      'stroke-width': props.strokeWidth ?? DEFAULTS.strokeWidth,
    }),
};

export const shapeSvg = (node: PositionedShape): string =>
  shapeBuilders[node.props.kind](node.frame, { ...node.props, stroke: strokeColorOf(node.props) });

/** Box só desenha algo quando tem fill ou stroke; senão é só contêiner. */
export const boxSvg = (node: PositionedBox): string => {
  const { fill, stroke, radius } = node.props;
  if (fill === undefined && stroke === undefined) return '';
  const kind: ShapeKind = radius !== undefined && radius > 0 ? 'roundRect' : 'rect';
  return shapeBuilders[kind](node.frame, node.props);
};

const ANCHORS: Readonly<Record<TextAlign, { readonly anchor: string; readonly offset: number }>> = {
  left: { anchor: 'start', offset: 0 },
  center: { anchor: 'middle', offset: 0.5 },
  right: { anchor: 'end', offset: 1 },
};

export interface TextSvgOptions {
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
}

/** Um <text> por linha já quebrada: o SVG nunca decide quebra sozinho. */
export const textSvg = (node: PositionedText, options: TextSvgOptions = {}): string => {
  const style = textStyleOf(node.props);
  const { anchor, offset } = ANCHORS[node.props.align ?? DEFAULTS.text.align];
  const { lines, lineHeight, ascent, fontSize } = node.text;
  const common: Attrs = {
    x: node.frame.x + node.frame.width * offset,
    'text-anchor': anchor,
    'font-family': options.fontFamilyMap?.[style.family] ?? style.family,
    'font-size': fontSize,
    'font-weight': style.weight === 'bold' ? 'bold' : 'normal',
    'font-style': style.italic ? 'italic' : 'normal',
    fill: node.props.color ?? DEFAULTS.text.color,
    'xml:space': 'preserve',
  };
  return lines
    .map((line, i) => element('text', { ...common, y: node.frame.y + i * lineHeight + ascent }, escapeXml(line)))
    .join('');
};

const ASPECT_BY_FIT: Readonly<Record<ImageFit, string>> = {
  contain: 'xMidYMid meet',
  cover: 'xMidYMid slice',
};

/** cover recorta pelo frame; clipId precisa ser único no documento. */
export const imageElementSvg = (frame: Rect, href: string, fit: ImageFit, clipId: string): string => {
  const image = element('image', { ...rectAttrs(frame), href, preserveAspectRatio: ASPECT_BY_FIT[fit] });
  if (fit === 'contain') return image;
  const clip = element('clipPath', { id: clipId }, element('rect', rectAttrs(frame)));
  return `${element('defs', {}, clip)}${element('g', { 'clip-path': `url(#${clipId})` }, image)}`;
};

export const imageSvg = (node: PositionedImage, href: string, clipId: string): string =>
  imageElementSvg(node.frame, href, imageFitOf(node.props), clipId);

export const backgroundColorSvg = (frame: Rect, color: Color): string =>
  element('rect', { ...rectAttrs(frame), fill: color });

export const debugOutlineSvg = (frame: Rect): string =>
  element('rect', {
    ...rectAttrs(frame),
    fill: 'none',
    stroke: DEBUG_OUTLINE.color,
    'stroke-width': DEBUG_OUTLINE.width,
    'stroke-dasharray': DEBUG_OUTLINE.dash,
  });

/** Faixas do filho que ficam fora do pai (até 4 retângulos sem sobreposição). */
export const overflowRectsOf = (child: Rect, parent: Rect): readonly Rect[] => {
  const right = child.x + child.width;
  const bottom = child.y + child.height;
  const parentRight = parent.x + parent.width;
  const parentBottom = parent.y + parent.height;
  const bandTop = Math.max(child.y, parent.y);
  const bandBottom = Math.min(bottom, parentBottom);
  const candidates: readonly Rect[] = [
    { x: child.x, y: child.y, width: child.width, height: Math.min(parent.y, bottom) - child.y },
    { x: child.x, y: Math.max(parentBottom, child.y), width: child.width, height: bottom - Math.max(parentBottom, child.y) },
    { x: child.x, y: bandTop, width: Math.min(parent.x, right) - child.x, height: bandBottom - bandTop },
    { x: Math.max(parentRight, child.x), y: bandTop, width: right - Math.max(parentRight, child.x), height: bandBottom - bandTop },
  ];
  return candidates.filter((r) => r.width > OVERFLOW_EPSILON && r.height > OVERFLOW_EPSILON);
};

export const overflowSvg = (rect: Rect): string =>
  element('rect', { ...rectAttrs(rect), fill: DEBUG_OVERFLOW.color, 'fill-opacity': DEBUG_OVERFLOW.opacity });
