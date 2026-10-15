import { arrowSizeOf } from '../core/defaults.ts';
import type { ArrowType, Color, LineStyle, Pt } from '../core/types.ts';
import { element } from './xml.ts';

/**
 * Pontas de seta e traço de linha no preview (M12): polígonos explícitos, nunca `<marker>`
 * (lição do README: nem todo renderizador desenha marker com orientação automática). O
 * tamanho segue a ponta `med` do OOXML (arrowSizeOf), igual ao que o emissor grava.
 */

export interface Point {
  readonly x: Pt;
  readonly y: Pt;
}

const fmt = (value: number): string => String(Math.round(value * 1000) / 1000);

const pointsAttr = (points: readonly Point[]): string => points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ');

interface Frame {
  /** Vetor unitário da linha, apontando para a ponta. */
  readonly ux: number;
  readonly uy: number;
}

const directionOf = (tip: Point, from: Point): Frame => {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { ux: dx / length, uy: dy / length };
};

/** Ponto a `back` para trás da ponta e `side` para a esquerda (negativo = direita) da linha. */
const offset = (tip: Point, { ux, uy }: Frame, back: number, side: number): Point => ({
  x: tip.x - ux * back - uy * side,
  y: tip.y - uy * back + ux * side,
});

/** Quanto a linha recua na ponta para o traço não passar da seta cheia. */
export const arrowInsetOf = (type: ArrowType | undefined, strokeWidth: Pt): Pt => {
  if (type === undefined || type === 'none' || type === 'arrow') return 0;
  const { length } = arrowSizeOf(strokeWidth);
  if (type === 'triangle') return length;
  if (type === 'stealth') return length * STEALTH_NOTCH;
  return 0;
};

/** Reentrância da ponta stealth: o recorte de trás fica a esta fração do comprimento. */
const STEALTH_NOTCH = 0.6;

/** A ponta no fim `tip` de um segmento que vem de `from`. */
export const arrowHeadSvg = (type: ArrowType | undefined, tip: Point, from: Point, strokeWidth: Pt, color: Color): string => {
  if (type === undefined || type === 'none') return '';
  const { width, length } = arrowSizeOf(strokeWidth);
  const dir = directionOf(tip, from);
  const half = width / 2;
  const filled = { fill: color, stroke: 'none' };
  if (type === 'triangle') {
    return element('polygon', { points: pointsAttr([tip, offset(tip, dir, length, half), offset(tip, dir, length, -half)]), ...filled });
  }
  if (type === 'stealth') {
    const notch = offset(tip, dir, length * STEALTH_NOTCH, 0);
    return element('polygon', { points: pointsAttr([tip, offset(tip, dir, length, half), notch, offset(tip, dir, length, -half)]), ...filled });
  }
  if (type === 'arrow') {
    const open = [offset(tip, dir, length, half), tip, offset(tip, dir, length, -half)];
    return element('polyline', { points: pointsAttr(open), fill: 'none', stroke: color, 'stroke-width': strokeWidth, 'stroke-linejoin': 'miter' });
  }
  if (type === 'diamond') {
    const points = [offset(tip, dir, -length / 2, 0), offset(tip, dir, 0, half), offset(tip, dir, length / 2, 0), offset(tip, dir, 0, -half)];
    return element('polygon', { points: pointsAttr(points), ...filled });
  }
  const angle = (Math.atan2(dir.uy, dir.ux) * 180) / Math.PI;
  return element('ellipse', { cx: tip.x, cy: tip.y, rx: length / 2, ry: half, transform: `rotate(${fmt(angle)} ${fmt(tip.x)} ${fmt(tip.y)})`, ...filled });
};

/** Recua `tip` em direção a `from` (sem passar do meio do segmento). */
export const insetPoint = (tip: Point, from: Point, amount: Pt): Point => {
  if (amount <= 0) return tip;
  const length = Math.hypot(tip.x - from.x, tip.y - from.y);
  if (length === 0) return tip;
  const cut = Math.min(amount, length / 2) / length;
  return { x: tip.x + (from.x - tip.x) * cut, y: tip.y + (from.y - tip.y) * cut };
};

/** Comprimento mínimo de um traço no SVG: 0 some no resvg; com ponta redonda vira um ponto. */
const MIN_DASH = 0.001;

/**
 * `stroke-dasharray` do prstDash: dash = 4 × espessura com espaço 3 ×; sysDot = 1 × com espaço 1 ×.
 * Com ponta redonda o PPTX mantém o período e a ponta come metade da espessura de cada lado (o
 * pontilhado vira bolinhas), então o traço encolhe 1 × e o espaço cresce 1 ×.
 */
export const dashArrayOf = (style: LineStyle | undefined, strokeWidth: Pt, round = false): string | undefined => {
  const pattern = style === 'dashed' ? [4, 3] : style === 'dotted' ? [1, 1] : undefined;
  if (pattern === undefined) return undefined;
  const [dash, gap] = pattern.map((factor) => factor * strokeWidth) as [number, number];
  if (!round) return `${fmt(dash)} ${fmt(gap)}`;
  return `${fmt(Math.max(dash - strokeWidth, MIN_DASH))} ${fmt(gap + strokeWidth)}`;
};
