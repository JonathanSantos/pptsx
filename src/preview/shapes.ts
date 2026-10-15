import { DEFAULTS } from '../core/defaults.ts';
import type { Rect, ShapeKind } from '../core/types.ts';

/**
 * Geometria das formas preset no preview (M12-2): as fórmulas do `presetShapeDefinitions.xml`
 * do OOXML com os mesmos `adj` que o PPTX usa por padrão (DEFAULTS.shape.pptx), para o PNG
 * bater com o Keynote/PowerPoint. Puro: frame → `d` do SVG em coordenadas do slide.
 * rect, roundRect, ellipse e line continuam com elementos próprios em svg.ts.
 */

export interface ShapeGeometry {
  /** Contorno preenchido (fill e, quando `stroke` é ausente, também o traço). */
  readonly fill: string;
  /** Traço próprio quando difere do contorno (cilindro, colchetes); ausente = o do fill. */
  readonly stroke?: string;
  /** Face com `fill="lighten"` no OOXML (tampa do cilindro), pintada mais clara por cima do fill. */
  readonly lighten?: string;
}

type Point = readonly [number, number];

/** Variáveis-guia do OOXML para um frame: l, t, r, b, w, h, hc, vc, ss (menor lado). */
interface Guides {
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
  readonly w: number;
  readonly h: number;
  readonly hc: number;
  readonly vc: number;
  readonly ss: number;
}

const guidesOf = (frame: Rect): Guides => ({
  l: frame.x,
  t: frame.y,
  r: frame.x + frame.width,
  b: frame.y + frame.height,
  w: frame.width,
  h: frame.height,
  hc: frame.x + frame.width / 2,
  vc: frame.y + frame.height / 2,
  ss: Math.min(frame.width, frame.height),
});

const SCALE = DEFAULTS.shape.adjScale;

/** `adj` padrão da kind como fração (50000 → 0,5). */
const adjOf = (kind: ShapeKind, name: string): number => (DEFAULTS.shape.pptx[kind].adj[name] ?? 0) / SCALE;

/** OOXML `pin min x max`. */
const pin = (min: number, value: number, max: number): number => Math.min(Math.max(value, min), max);

const fmt = (value: number): string => String(Math.round(value * 1000) / 1000);

const polygon = (points: readonly Point[]): string =>
  `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L')} Z`;

const DEGREES = Math.PI / 180;

const triangle = (g: Guides): string => {
  const x = g.l + g.w * adjOf('triangle', 'adj');
  return polygon([[g.l, g.b], [x, g.t], [g.r, g.b]]);
};

const rightTriangle = (g: Guides): string => polygon([[g.l, g.b], [g.l, g.t], [g.r, g.b]]);

const diamond = (g: Guides): string => polygon([[g.l, g.vc], [g.hc, g.t], [g.r, g.vc], [g.hc, g.b]]);

const parallelogram = (g: Guides): string => {
  const a = pin(0, adjOf('parallelogram', 'adj'), g.w / g.ss);
  const x2 = g.ss * a;
  return polygon([[g.l, g.b], [g.l + x2, g.t], [g.r, g.t], [g.r - x2, g.b]]);
};

const trapezoid = (g: Guides): string => {
  const a = pin(0, adjOf('trapezoid', 'adj'), g.w / g.ss / 2);
  const x2 = g.ss * a;
  return polygon([[g.l, g.b], [g.l + x2, g.t], [g.r - x2, g.t], [g.r, g.b]]);
};

/** Pentágono/estrela do OOXML: elipse escalada por hf/vf e centro vertical deslocado (svc). */
const pentagonFrame = (kind: 'pentagon' | 'star', g: Guides) => {
  const swd2 = (g.w / 2) * adjOf(kind, 'hf');
  const shd2 = (g.h / 2) * adjOf(kind, 'vf');
  const svc = g.t + (g.h / 2) * adjOf(kind, 'vf');
  return { swd2, shd2, svc };
};

/** Os 5 vértices externos, a partir do topo, no sentido horário. */
const outerPoints = (g: Guides, swd2: number, shd2: number, svc: number): readonly Point[] => {
  const dx1 = swd2 * Math.cos(18 * DEGREES);
  const dx2 = swd2 * Math.cos(54 * DEGREES);
  const y1 = svc - shd2 * Math.sin(18 * DEGREES);
  const y2 = svc + shd2 * Math.sin(54 * DEGREES);
  return [[g.hc, g.t], [g.hc + dx1, y1], [g.hc + dx2, y2], [g.hc - dx2, y2], [g.hc - dx1, y1]];
};

const pentagon = (g: Guides): string => {
  const { swd2, shd2, svc } = pentagonFrame('pentagon', g);
  return polygon(outerPoints(g, swd2, shd2, svc));
};

const star = (g: Guides): string => {
  const { swd2, shd2, svc } = pentagonFrame('star', g);
  const outer = outerPoints(g, swd2, shd2, svc);
  // Raio interno = externo × adj/50000 (19098 → 0,382, a estrela regular).
  const ratio = adjOf('star', 'adj') * 2;
  const iwd2 = swd2 * ratio;
  const ihd2 = shd2 * ratio;
  const inner: readonly Point[] = [-54, 18, 90, 162, 234].map((degrees) => [
    g.hc + iwd2 * Math.cos(degrees * DEGREES),
    svc + ihd2 * Math.sin(degrees * DEGREES),
  ]);
  return polygon(outer.flatMap((point, index) => [point, inner[index]!]));
};

const hexagon = (g: Guides): string => {
  const a = pin(0, adjOf('hexagon', 'adj'), g.w / g.ss / 2);
  const x1 = g.ss * a;
  return polygon([[g.l, g.vc], [g.l + x1, g.t], [g.r - x1, g.t], [g.r, g.vc], [g.r - x1, g.b], [g.l + x1, g.b]]);
};

const octagon = (g: Guides): string => {
  const x1 = g.ss * pin(0, adjOf('octagon', 'adj'), 0.5);
  return polygon([
    [g.l, g.t + x1],
    [g.l + x1, g.t],
    [g.r - x1, g.t],
    [g.r, g.t + x1],
    [g.r, g.b - x1],
    [g.r - x1, g.b],
    [g.l + x1, g.b],
    [g.l, g.b - x1],
  ]);
};

const chevron = (g: Guides): string => {
  const x1 = g.ss * pin(0, adjOf('chevron', 'adj'), g.w / g.ss);
  return polygon([[g.l, g.t], [g.r - x1, g.t], [g.r, g.vc], [g.r - x1, g.b], [g.l, g.b], [g.l + x1, g.vc]]);
};

/** Seta horizontal: haste com adj1 da altura, cabeça com adj2 do menor lado. */
const horizontalArrow = (kind: 'arrowRight' | 'arrowLeft', g: Guides): string => {
  const dy = (g.h * pin(0, adjOf(kind, 'adj1'), 1)) / 2;
  const head = g.ss * pin(0, adjOf(kind, 'adj2'), g.w / g.ss);
  const y1 = g.vc - dy;
  const y2 = g.vc + dy;
  if (kind === 'arrowRight') {
    const x1 = g.r - head;
    return polygon([[g.l, y1], [x1, y1], [x1, g.t], [g.r, g.vc], [x1, g.b], [x1, y2], [g.l, y2]]);
  }
  const x1 = g.l + head;
  return polygon([[g.l, g.vc], [x1, g.t], [x1, y1], [g.r, y1], [g.r, y2], [x1, y2], [x1, g.b]]);
};

const verticalArrow = (kind: 'arrowUp' | 'arrowDown', g: Guides): string => {
  const dx = (g.w * pin(0, adjOf(kind, 'adj1'), 1)) / 2;
  const head = g.ss * pin(0, adjOf(kind, 'adj2'), g.h / g.ss);
  const x1 = g.hc - dx;
  const x2 = g.hc + dx;
  if (kind === 'arrowDown') {
    const y1 = g.b - head;
    return polygon([[x1, g.t], [x2, g.t], [x2, y1], [g.r, y1], [g.hc, g.b], [g.l, y1], [x1, y1]]);
  }
  const y1 = g.t + head;
  return polygon([[g.hc, g.t], [g.r, y1], [x2, y1], [x2, g.b], [x1, g.b], [x1, y1], [g.l, y1]]);
};

const doubleArrow = (g: Guides): string => {
  const dy = (g.h * pin(0, adjOf('doubleArrow', 'adj1'), 1)) / 2;
  const head = g.ss * pin(0, adjOf('doubleArrow', 'adj2'), g.w / g.ss / 2);
  const x2 = g.l + head;
  const x3 = g.r - head;
  const y1 = g.vc - dy;
  const y2 = g.vc + dy;
  return polygon([
    [g.l, g.vc],
    [x2, g.t],
    [x2, y1],
    [x3, y1],
    [x3, g.t],
    [g.r, g.vc],
    [x3, g.b],
    [x3, y2],
    [x2, y2],
    [x2, g.b],
  ]);
};

/**
 * wedgeRectCallout: retângulo com a ponta saindo do lado mais próximo do alvo (adj1, adj2 =
 * deslocamento do alvo a partir do centro, em fração de w e h). Com os padrões a ponta sai da
 * base, entre 1/6 e 5/12 da largura, e passa 12,5 % da altura abaixo do frame.
 */
const callout = (g: Guides): string => {
  const dxPos = g.w * adjOf('callout', 'adj1');
  const dyPos = g.h * adjOf('callout', 'adj2');
  const xPos = g.hc + dxPos;
  const yPos = g.vc + dyPos;
  const dz = Math.abs(dyPos) - Math.abs((dxPos * g.h) / g.w);
  const x1 = g.l + (g.w * (dxPos > 0 ? 7 : 2)) / 12;
  const x2 = g.l + (g.w * (dxPos > 0 ? 10 : 5)) / 12;
  const y1 = g.t + (g.h * (dyPos > 0 ? 7 : 2)) / 12;
  const y2 = g.t + (g.h * (dyPos > 0 ? 10 : 5)) / 12;
  const vertical = dz > 0;
  const tipTop: Point = vertical && dyPos <= 0 ? [xPos, yPos] : [x1, g.t];
  const tipBottom: Point = vertical && dyPos > 0 ? [xPos, yPos] : [x1, g.b];
  const tipLeft: Point = !vertical && dxPos <= 0 ? [xPos, yPos] : [g.l, y1];
  const tipRight: Point = !vertical && dxPos > 0 ? [xPos, yPos] : [g.r, y1];
  return polygon([
    [g.l, g.t],
    [x1, g.t],
    tipTop,
    [x2, g.t],
    [g.r, g.t],
    [g.r, y1],
    tipRight,
    [g.r, y2],
    [g.r, g.b],
    [x2, g.b],
    tipBottom,
    [x1, g.b],
    [g.l, g.b],
    [g.l, y2],
    tipLeft,
    [g.l, y1],
  ]);
};

const arc = (rx: number, ry: number, sweep: 0 | 1, x: number, y: number, large: 0 | 1 = 0): string =>
  `A${fmt(rx)} ${fmt(ry)} 0 ${large} ${sweep} ${fmt(x)} ${fmt(y)}`;

const move = (x: number, y: number): string => `M${fmt(x)} ${fmt(y)}`;
const line = (x: number, y: number): string => `L${fmt(x)} ${fmt(y)}`;

/** bracketPair: preenche o retângulo arredondado; o traço são só os dois colchetes. */
const bracketPair = (g: Guides): ShapeGeometry => {
  const x1 = g.ss * pin(0, adjOf('bracketPair', 'adj'), 0.5);
  const left = [move(g.l + x1, g.b), arc(x1, x1, 1, g.l, g.b - x1), line(g.l, g.t + x1), arc(x1, x1, 1, g.l + x1, g.t)].join(' ');
  const right = [move(g.r - x1, g.t), arc(x1, x1, 1, g.r, g.t + x1), line(g.r, g.b - x1), arc(x1, x1, 1, g.r - x1, g.b)].join(' ');
  const fill = [
    move(g.l + x1, g.t),
    line(g.r - x1, g.t),
    arc(x1, x1, 1, g.r, g.t + x1),
    line(g.r, g.b - x1),
    arc(x1, x1, 1, g.r - x1, g.b),
    line(g.l + x1, g.b),
    arc(x1, x1, 1, g.l, g.b - x1),
    line(g.l, g.t + x1),
    arc(x1, x1, 1, g.l + x1, g.t),
    'Z',
  ].join(' ');
  return { fill, stroke: `${left} ${right}` };
};

/** can: corpo com a elipse de cima inteira (raio vertical = ss × adj/200000); o traço desenha a tampa inteira. */
const cylinder = (g: Guides): ShapeGeometry => {
  const ry = (g.ss * pin(0, adjOf('cylinder', 'adj'), g.h / g.ss / 2)) / 2;
  const rx = g.w / 2;
  const y1 = g.t + ry;
  const y3 = g.b - ry;
  const fill = [move(g.l, y1), arc(rx, ry, 1, g.r, y1), line(g.r, y3), arc(rx, ry, 1, g.l, y3), 'Z'].join(' ');
  const stroke = [
    move(g.r, y1),
    arc(rx, ry, 1, g.l, y1),
    arc(rx, ry, 1, g.r, y1),
    line(g.r, y3),
    arc(rx, ry, 1, g.l, y3),
    line(g.l, y1),
  ].join(' ');
  const lighten = [move(g.l, y1), arc(rx, ry, 1, g.r, y1), arc(rx, ry, 1, g.l, y1), 'Z'].join(' ');
  return { fill, stroke, lighten };
};

// cloud: o caminho do OOXML (espaço 43200 × 43200) com arcTo em ângulos visuais (1/60000 grau).
const CLOUD_SPACE = 43200;
const CLOUD_START: Point = [3900, 14370];
const CLOUD_ARCS: readonly (readonly [wR: number, hR: number, stAng: number, swAng: number])[] = [
  [6753, 9190, -11429249, 7426832],
  [5333, 7267, -8646143, 5396714],
  [4365, 5945, -8748475, 5983381],
  [4857, 6595, -7859164, 7034504],
  [5333, 7273, -4722533, 6541615],
  [6775, 9220, -2776035, 7816140],
  [5785, 7867, 37501, 6842000],
  [6752, 9215, 1347096, 6910353],
  [7720, 10543, 3974558, 4542661],
  [4360, 5918, -16496525, 8804134],
  [4345, 5945, -14809710, 9151131],
];
const OOXML_ANGLE = 60000;

/** Ângulo visual do OOXML → ângulo paramétrico da elipse (wR, hR). */
const parametricOf = (visual: number, wR: number, hR: number): number => Math.atan2(wR * Math.sin(visual), hR * Math.cos(visual));

interface CloudState {
  readonly at: Point;
  readonly parts: readonly string[];
}

const cloud = (g: Guides): string => {
  const sx = g.w / CLOUD_SPACE;
  const sy = g.h / CLOUD_SPACE;
  const toFrame = ([x, y]: Point): Point => [g.l + x * sx, g.t + y * sy];
  const start = toFrame(CLOUD_START);
  const { parts } = CLOUD_ARCS.reduce<CloudState>(
    (state, [wR, hR, stAng, swAng]) => {
      const st = (stAng / OOXML_ANGLE) * DEGREES;
      const sw = (swAng / OOXML_ANGLE) * DEGREES;
      const t1 = parametricOf(st, wR, hR);
      const t2 = parametricOf(st + sw, wR, hR);
      // Centro no espaço do caminho: o ponto atual está na elipse no ângulo t1.
      const [ax, ay] = state.at;
      const cx = ax - wR * Math.cos(t1);
      const cy = ay - hR * Math.sin(t1);
      const end: Point = [cx + wR * Math.cos(t2), cy + hR * Math.sin(t2)];
      const [ex, ey] = toFrame(end);
      const large: 0 | 1 = Math.abs(sw) > Math.PI ? 1 : 0;
      return { at: end, parts: [...state.parts, arc(wR * sx, hR * sy, sw > 0 ? 1 : 0, ex, ey, large)] };
    },
    { at: CLOUD_START, parts: [move(start[0], start[1])] },
  );
  return `${parts.join(' ')} Z`;
};

type GeometryBuilder = (g: Guides) => string | ShapeGeometry;

const BUILDERS: Readonly<Partial<Record<ShapeKind, GeometryBuilder>>> = {
  triangle,
  rightTriangle,
  diamond,
  parallelogram,
  trapezoid,
  pentagon,
  hexagon,
  octagon,
  chevron,
  arrowRight: (g) => horizontalArrow('arrowRight', g),
  arrowLeft: (g) => horizontalArrow('arrowLeft', g),
  arrowUp: (g) => verticalArrow('arrowUp', g),
  arrowDown: (g) => verticalArrow('arrowDown', g),
  doubleArrow,
  star,
  cloud,
  callout,
  bracketPair,
  cylinder,
};

/** Kinds com desenho próprio aqui (as demais são rect/roundRect/pill/ellipse/line em svg.ts). */
export const hasPresetGeometry = (kind: ShapeKind): boolean => BUILDERS[kind] !== undefined;

/** Geometria de uma kind preset no frame; undefined para as que svg.ts desenha com elemento próprio. */
export const shapeGeometryOf = (kind: ShapeKind, frame: Rect): ShapeGeometry | undefined => {
  const builder = BUILDERS[kind];
  if (builder === undefined) return undefined;
  const result = builder(guidesOf(frame));
  return typeof result === 'string' ? { fill: result } : result;
};
