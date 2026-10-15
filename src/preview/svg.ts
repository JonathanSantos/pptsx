import { DEFAULTS, imageFitOf, strokeColorOf, textStyleOf, weightValueOf } from '../core/defaults.ts';
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
  RunFace,
  ShapeKind,
  ShapeProps,
  StrokeProps,
  TextAlign,
  TextLayout,
  TextRun,
  VerticalAlign,
} from '../core/types.ts';
import { arrowHeadSvg, arrowInsetOf, dashArrayOf, insetPoint, type Point } from './arrows.ts';
import { shapeGeometryOf, type ShapeGeometry } from './shapes.ts';
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

/** `lighten` do OOXML clareia a cor ~40 %: um véu branco com esta opacidade chega perto. */
const LIGHTEN_OPACITY = 0.4;

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

const pillRadiusOf = (frame: Rect): Pt => Math.min(frame.width, frame.height) / 2;

const shapeBuilders: Readonly<Partial<Record<ShapeKind, ShapeBuilder>>> = {
  rect: (frame, props) => element('rect', { ...rectAttrs(frame), ...paintAttrs(props) }),
  roundRect: (frame, props) => {
    const r = cornerRadiusOf(props.radius, frame);
    return element('rect', { ...rectAttrs(frame), rx: r, ry: r, ...paintAttrs(props) });
  },
  pill: (frame, props) => {
    const r = pillRadiusOf(frame);
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
};

/** Face clareada (tampa do cilindro: `fill="lighten"` do OOXML) como um véu branco translúcido. */
const lightenSvg = (geometry: ShapeGeometry, fill: Color | undefined): string =>
  geometry.lighten === undefined || fill === undefined ? '' : element('path', { d: geometry.lighten, fill: '#FFFFFF', 'fill-opacity': LIGHTEN_OPACITY });

/** M12: geometria preset em <path>; com traço próprio (cilindro, colchetes) o fill e o traço saem separados. */
const presetSvg = (kind: ShapeKind, frame: Rect, props: StrokeProps): string => {
  const geometry = shapeGeometryOf(kind, frame);
  if (geometry === undefined) return element('rect', { ...rectAttrs(frame), ...paintAttrs(props) });
  if (geometry.stroke === undefined) return element('path', { d: geometry.fill, ...paintAttrs(props) });
  return (
    element('path', { d: geometry.fill, ...paintAttrs({ fill: props.fill }) }) +
    lightenSvg(geometry, props.fill) +
    element('path', { d: geometry.stroke, ...paintAttrs({ stroke: props.stroke, strokeWidth: props.strokeWidth }) })
  );
};

/** Desenho do contorno de uma kind no frame (sem flip, traço ou setas). */
export const shapeOutlineSvg = (kind: ShapeKind, frame: Rect, props: StrokeProps & { readonly radius?: Pt }): string =>
  (shapeBuilders[kind] ?? ((f: Rect, p: StrokeProps) => presetSvg(kind, f, p)))(frame, props);

/**
 * M12: uma kind (não rect) desenhada com atributos prontos — fundo, borda ou contorno de um Box
 * com `shape`. `part` escolhe o contorno preenchido ou o traço próprio (cilindro, colchetes).
 */
export const kindSvg = (kind: ShapeKind, frame: Rect, attrs: Attrs, part: 'fill' | 'stroke'): string => {
  if (kind === 'ellipse') {
    return element('ellipse', { cx: frame.x + frame.width / 2, cy: frame.y + frame.height / 2, rx: frame.width / 2, ry: frame.height / 2, ...attrs });
  }
  if (kind === 'pill') {
    const r = pillRadiusOf(frame);
    return element('rect', { ...rectAttrs(frame), rx: r, ry: r, ...attrs });
  }
  const geometry = shapeGeometryOf(kind, frame);
  if (geometry === undefined) return element('rect', { ...rectAttrs(frame), ...attrs });
  if (part === 'stroke') return element('path', { d: geometry.stroke ?? geometry.fill, ...attrs });
  const fill = attrs.fill === 'none' ? undefined : (attrs.fill as Color | undefined);
  return element('path', { d: geometry.fill, ...attrs }) + lightenSvg(geometry, fill);
};

/** Extremos da linha: da quina sup. esq. à inf. dir. do frame, espelhados por flipH/flipV (como o PPTX). */
const lineEndsOf = (frame: Rect, flipH: boolean, flipV: boolean): readonly [Point, Point] => {
  const left = frame.x;
  const right = frame.x + frame.width;
  const top = frame.y;
  const bottom = frame.y + frame.height;
  return [
    { x: flipH ? right : left, y: flipV ? bottom : top },
    { x: flipH ? left : right, y: flipV ? top : bottom },
  ];
};

const lineSvg = (node: PositionedShape, stroke: string): string => {
  const { props } = node;
  const width = props.strokeWidth ?? DEFAULTS.strokeWidth;
  const [start, end] = lineEndsOf(node.frame, props.flipH === true, props.flipV === true);
  const from = insetPoint(start, end, arrowInsetOf(props.startArrow, width));
  const to = insetPoint(end, start, arrowInsetOf(props.endArrow, width));
  return (
    element('line', {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke,
      'stroke-width': width,
      'stroke-dasharray': dashArrayOf(props.lineStyle, width, props.lineCap === 'round'),
      'stroke-linecap': props.lineCap === 'round' ? 'round' : undefined,
    }) +
    arrowHeadSvg(props.startArrow, start, end, width, stroke) +
    arrowHeadSvg(props.endArrow, end, start, width, stroke)
  );
};

/** Espelho em torno do centro do frame (flipH/flipV do PPTX). */
const flipTransformOf = (frame: Rect, flipH: boolean, flipV: boolean): string | undefined => {
  if (!flipH && !flipV) return undefined;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  return `translate(${cx} ${cy}) scale(${flipH ? -1 : 1} ${flipV ? -1 : 1}) translate(${-cx} ${-cy})`;
};

/** Traço tracejado e ponta arredondada valem para o contorno inteiro (<g> herda para os filhos). */
const strokeStyleAttrs = (props: ShapeProps): Attrs => {
  const width = props.strokeWidth ?? DEFAULTS.strokeWidth;
  return {
    'stroke-dasharray': dashArrayOf(props.lineStyle, width, props.lineCap === 'round'),
    'stroke-linecap': props.lineCap === 'round' ? 'round' : undefined,
  };
};

export const shapeSvg = (node: PositionedShape): string => {
  const { props, frame } = node;
  const stroke = strokeColorOf(props);
  if (props.kind === 'line') return lineSvg(node, stroke ?? DEFAULTS.lineStroke);
  const body = shapeOutlineSvg(props.kind, frame, { ...props, stroke });
  const transform = flipTransformOf(frame, props.flipH === true, props.flipV === true);
  const style = strokeStyleAttrs(props);
  const styled = Object.values(style).some((value) => value !== undefined);
  if (transform === undefined && !styled) return body;
  return element('g', { transform, ...style }, body);
};

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
  /** M13: família da face escolhida (resvg), quando difere da do Text. */
  readonly family?: string;
  /** M13: sobrescrito/subscrito. */
  readonly verticalAlign?: VerticalAlign;
  /** M13: trecho com link: PowerPoint e Keynote sublinham (com a cor do texto). */
  readonly href?: string;
}

const textDecorationOf = (style: SvgRunStyle): string | undefined => {
  const parts = [style.underline || style.href !== undefined ? 'underline' : '', style.lineThrough ? 'line-through' : ''].filter(Boolean);
  return parts.length === 0 ? undefined : parts.join(' ');
};

/** 400/700 com os nomes de sempre; os outros pesos numéricos (o resvg escolhe a face por eles). */
const fontWeightAttr = (weight: FontWeight): string | number => {
  const value = weightValueOf(weight);
  if (value === DEFAULTS.text.weights.bold) return 'bold';
  if (value === DEFAULTS.text.weights.regular) return 'normal';
  return value;
};

const runStyleAttrs = (style: SvgRunStyle): Attrs => ({
  'font-family': style.family,
  'font-weight': fontWeightAttr(style.weight),
  'font-style': style.italic ? 'italic' : 'normal',
  fill: style.color,
  'text-decoration': textDecorationOf(style),
});

/** M13: corpo reduzido e deslocamento da baseline em pt (positivo sobe), como o `baseline` do OOXML. */
const verticalAttrs = (align: VerticalAlign | undefined, size: Pt): Attrs => {
  if (align !== 'super' && align !== 'sub') return {};
  const percent = align === 'super' ? DEFAULTS.text.superscriptBaseline : DEFAULTS.text.subscriptBaseline;
  return { 'font-size': size * DEFAULTS.text.superscriptRatio, 'baseline-shift': (percent / DEFAULTS.css.percentBase) * size };
};

const tspanOf = (text: string, style: SvgRunStyle, size: Pt): string =>
  element('tspan', { ...runStyleAttrs(style), ...verticalAttrs(style.verticalAlign, size), 'xml:space': 'preserve' }, escapeXml(text));

/** M13: a face que o medidor usou decide o peso e, fora de 400/700, a família do tspan. */
const withFace = (style: SvgRunStyle, face: RunFace | undefined, baseFamily: string): SvgRunStyle => {
  if (face === undefined) return style;
  const family = face.previewFamily === baseFamily ? undefined : face.previewFamily;
  return { ...style, weight: face.weight, ...(family === undefined ? {} : { family }) };
};

/** Um tspan por LineRun; sem lineRuns, a linha inteira num tspan com o estilo do Text. */
const lineTspansOf = (node: PositionedText, base: SvgRunStyle, baseFamily: string): readonly string[] => {
  const lineRuns = lineRunsOf(node.text);
  const faces = node.text.faces;
  const size = node.text.fontSize;
  if (lineRuns === undefined) return node.text.lines.map((line) => tspanOf(line, withFace(base, faces?.[0], baseFamily), size));
  const runs = textRunsOf(node);
  return lineRuns.map((pieces) =>
    pieces.map((piece) => tspanOf(piece.text, withFace(runs[piece.run] ?? base, faces?.[piece.run], baseFamily), size)).join(''),
  );
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
  const baseFamily = options.fontFamilyMap?.[style.family] ?? style.family;
  const common: Attrs = {
    x: node.frame.x + node.frame.width * offset,
    'text-anchor': anchor,
    'font-size': fontSize,
    'letter-spacing': node.css.letterSpacing === 0 ? undefined : node.css.letterSpacing,
    ...runStyleAttrs({ ...base, underline: false, lineThrough: false, family: baseFamily }),
    'xml:space': 'preserve',
  };
  return lineTspansOf(node, base, baseFamily)
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
