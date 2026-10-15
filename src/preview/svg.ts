import { DEFAULTS, imageFitOf, strokeColorOf, textStyleOf } from '../core/defaults.ts';
import type {
  Color,
  FontWeight,
  ImageFit,
  LineRun,
  PositionedImage,
  PositionedShape,
  PositionedText,
  Pt,
  Rect,
  ShapeKind,
  StrokeProps,
  TextAlign,
  TextLayout,
  TextRun,
} from '../core/types.ts';
import { element, escapeXml, type Attrs } from './xml.ts';

/**
 * Builders puros: nó posicionado → string SVG. Regras visuais espelham
 * src/emit/options.ts para o preview bater com o .pptx.
 */

/** Contorno de debug igual ao do emit: vermelho, 0.5 pt, tracejado. */
const DEBUG_OUTLINE = { color: '#FF0000', width: 0.5, dash: '2 1.5' } as const;
const DEBUG_OVERFLOW = { color: '#FF0000', opacity: 0.3 } as const;
/** Texto que estoura a caixa: contorno sólido e mais grosso para chamar atenção. */
const DEBUG_TEXT_OVERFLOW = { color: '#FF0000', width: 1 } as const;

/** roundRect sem radius no pptx usa a geometria padrão do preset (adj 16667 = 16,667% do menor lado). */
const PPTX_DEFAULT_ROUND_RATIO = 0.16667;

/** Diferenças menores que isso são ruído de ponto flutuante do layout. */
const OVERFLOW_EPSILON = 0.01;

export const rectAttrs = (frame: Rect): Attrs => ({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });

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

const shapeBuilders: Readonly<Partial<Record<ShapeKind, ShapeBuilder>>> = {
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
  (shapeBuilders[node.props.kind] ?? shapeBuilders.rect!)(node.frame, { ...node.props, stroke: strokeColorOf(node.props) });

export const ANCHORS: Readonly<Record<TextAlign, { readonly anchor: string; readonly offset: number }>> = {
  left: { anchor: 'start', offset: 0 },
  center: { anchor: 'middle', offset: 0.5 },
  right: { anchor: 'end', offset: 1 },
};

export interface TextSvgOptions {
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
}

// Árvores de antes do M8 (ou montadas à mão) podem não ter runs/lineRuns:
// aí cada linha vira um tspan só, com o estilo do Text.
const textRunsOf = (node: PositionedText): readonly TextRun[] => (Array.isArray(node.runs) ? node.runs : []);

const lineRunsOf = (layout: TextLayout): readonly (readonly LineRun[])[] | undefined =>
  Array.isArray(layout.lineRuns) && layout.lineRuns.length === layout.lines.length ? layout.lineRuns : undefined;

interface SvgRunStyle {
  readonly weight: FontWeight;
  readonly italic: boolean;
  readonly color: Color;
  /** M11: `textDecoration` do Text ou do Span, como no run do PPTX. */
  readonly underline?: boolean;
  readonly lineThrough?: boolean;
}

const textDecorationOf = (style: SvgRunStyle): string | undefined => {
  const parts = [style.underline ? 'underline' : '', style.lineThrough ? 'line-through' : ''].filter(Boolean);
  return parts.length === 0 ? undefined : parts.join(' ');
};

const runStyleAttrs = (style: SvgRunStyle): Attrs => ({
  'font-weight': style.weight === 'bold' ? 'bold' : 'normal',
  'font-style': style.italic ? 'italic' : 'normal',
  fill: style.color,
  'text-decoration': textDecorationOf(style),
});

const tspanOf = (text: string, style: SvgRunStyle): string =>
  element('tspan', { ...runStyleAttrs(style), 'xml:space': 'preserve' }, escapeXml(text));

/** Um tspan por LineRun; sem lineRuns, a linha inteira num tspan com o estilo do Text. */
const lineTspansOf = (node: PositionedText, base: SvgRunStyle): readonly string[] => {
  const lineRuns = lineRunsOf(node.text);
  if (lineRuns === undefined) return node.text.lines.map((line) => tspanOf(line, base));
  const runs = textRunsOf(node);
  return lineRuns.map((pieces) => pieces.map((piece) => tspanOf(piece.text, runs[piece.run] ?? base)).join(''));
};

/**
 * Um <text> por linha já quebrada: o SVG nunca decide quebra sozinho. `node.frame` é a área
 * onde as linhas ficam (o chamador passa a área de conteúdo). A decoração vai só nos tspans,
 * como nos runs do PPTX; `letterSpacing` vira `letter-spacing` (o `charSpacing` do run).
 */
export const textSvg = (node: PositionedText, options: TextSvgOptions = {}): string => {
  const style = textStyleOf(node.props);
  const { underline, lineThrough } = node.css.textDecoration;
  const base: SvgRunStyle = { weight: style.weight, italic: style.italic, color: node.props.color ?? DEFAULTS.text.color, underline, lineThrough };
  const { anchor, offset } = ANCHORS[node.props.align ?? DEFAULTS.text.align];
  const { lineHeight, ascent, fontSize } = node.text;
  const common: Attrs = {
    x: node.frame.x + node.frame.width * offset,
    'text-anchor': anchor,
    'font-family': options.fontFamilyMap?.[style.family] ?? style.family,
    'font-size': fontSize,
    'letter-spacing': node.css.letterSpacing === 0 ? undefined : node.css.letterSpacing,
    ...runStyleAttrs({ ...base, underline: false, lineThrough: false }),
    'xml:space': 'preserve',
  };
  return lineTspansOf(node, base)
    .map((tspans, i) => element('text', { ...common, y: node.frame.y + i * lineHeight + ascent }, tspans))
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

/**
 * Faixa do texto abaixo do frame quando a altura medida passa da caixa (mesma tolerância do fit).
 * Com fonte ausente a medição é estimada: o realce seria ruído (o JSON também suprime o estouro).
 */
export const textOverflowRectOf = (node: PositionedText): Rect | undefined => {
  const { frame, text } = node;
  if (text.fontMissing) return undefined;
  if (text.height <= frame.height + DEFAULTS.fit.epsilon) return undefined;
  return { x: frame.x, y: frame.y + frame.height, width: frame.width, height: text.height - frame.height };
};

/**
 * nowrap: parte da linha que passa da largura disponível (o frame cortado pela área de
 * conteúdo do pai, como no fit). Numa row o minWidth alarga o frame até a linha, então
 * comparar só com o frame esconderia o estouro.
 */
export const textWidthOverflowRectOf = (node: PositionedText, available: Pt = node.frame.width): Rect | undefined => {
  const { frame, text } = node;
  if (node.props.nowrap !== true || text.fontMissing) return undefined;
  const excess = text.width - available;
  if (excess <= DEFAULTS.fit.epsilon) return undefined;
  return { x: frame.x + available, y: frame.y, width: excess, height: text.height };
};

const solidOutlineAttrs: Attrs = {
  fill: 'none',
  stroke: DEBUG_TEXT_OVERFLOW.color,
  'stroke-width': DEBUG_TEXT_OVERFLOW.width,
};

const overflowBandSvg = (band: Rect): string =>
  element('rect', {
    ...rectAttrs(band),
    ...solidOutlineAttrs,
    fill: DEBUG_OVERFLOW.color,
    'fill-opacity': DEBUG_OVERFLOW.opacity,
  });

/** Faixas estouradas (translúcidas, contorno sólido) + caixa do texto em contorno sólido. */
export const textOverflowSvg = (frame: Rect, bands: Rect | readonly Rect[]): string =>
  [bands].flat().map(overflowBandSvg).join('') + element('rect', { ...rectAttrs(frame), ...solidOutlineAttrs });

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
