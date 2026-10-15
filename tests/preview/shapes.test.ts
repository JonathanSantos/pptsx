import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { ShapeKind } from '../../src/core/types.ts';
import { shapeGeometryOf } from '../../src/preview/shapes.ts';
import { shapeSvg } from '../../src/preview/svg.ts';
import { dashArrayOf } from '../../src/preview/arrows.ts';
import { pShape, rect } from '../helpers/nodes.ts';

const FRAME = rect(10, 20, 100, 50);
const KINDS = (Object.keys(DEFAULTS.shape.pptx) as ShapeKind[]).filter((kind) => kind !== 'line');

/** Pares x y de um `d` só com M/L (polígonos). */
const pointsOf = (d: string): readonly (readonly [number, number])[] =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

const ELEMENT_BY_KIND: Partial<Record<ShapeKind, string>> = { rect: '<rect', roundRect: '<rect', pill: '<rect', ellipse: '<ellipse' };

describe('M12-2 — preview por kind', () => {
  it.each(KINDS)('"%s" desenha o elemento esperado', (kind) => {
    const svg = shapeSvg(pShape(FRAME, { kind, fill: '#336699' }));
    expect(svg.startsWith(ELEMENT_BY_KIND[kind] ?? '<path')).toBe(true);
  });

  it('chevron com adj 50 %: ponta a 25 pt (metade do menor lado) da direita', () => {
    const points = pointsOf(shapeGeometryOf('chevron', FRAME)!.fill);
    expect(points).toContainEqual([110, 45]);
    expect(points).toContainEqual([85, 20]);
    expect(points).toContainEqual([35, 45]);
  });

  it('arrowRight: haste com 50 % da altura e cabeça de 25 pt', () => {
    const points = pointsOf(shapeGeometryOf('arrowRight', FRAME)!.fill);
    expect(points).toEqual([[10, 32.5], [85, 32.5], [85, 20], [110, 45], [85, 70], [85, 57.5], [10, 57.5]]);
  });

  it('hexágono: vértices a 25 % do menor lado', () => {
    expect(pointsOf(shapeGeometryOf('hexagon', FRAME)!.fill)).toEqual([[10, 45], [22.5, 20], [97.5, 20], [110, 45], [97.5, 70], [22.5, 70]]);
  });

  it('pentágono e estrela tocam o topo, a base e as laterais do frame', () => {
    for (const kind of ['pentagon', 'star'] as const) {
      const points = pointsOf(shapeGeometryOf(kind, FRAME)!.fill);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      expect(Math.min(...xs)).toBeCloseTo(10, 0);
      expect(Math.max(...xs)).toBeCloseTo(110, 0);
      expect(Math.min(...ys)).toBeCloseTo(20, 1);
      expect(Math.max(...ys)).toBeCloseTo(70, 0);
    }
  });

  it('callout: ponta abaixo do frame (12,5 % da altura)', () => {
    const points = pointsOf(shapeGeometryOf('callout', FRAME)!.fill);
    expect(points).toContainEqual([39.167, 76.25]);
  });

  it('cilindro e colchetes têm traço próprio', () => {
    expect(shapeGeometryOf('cylinder', FRAME)!.stroke).toBeDefined();
    expect(shapeGeometryOf('bracketPair', FRAME)!.stroke).toBeDefined();
  });

  it('line com setas: polígonos explícitos, sem <marker>', () => {
    const svg = shapeSvg(pShape(rect(0, 10, 100, 0), { kind: 'line', stroke: '#000000', strokeWidth: 2, startArrow: 'oval', endArrow: 'triangle' }));
    expect(svg).not.toContain('<marker');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<ellipse');
    // A linha recua o comprimento da ponta cheia (3 × 2 pt).
    expect(svg).toMatch(/x2="94"/);
  });

  it('flip: <g> com scale em torno do centro; line troca as pontas', () => {
    expect(shapeSvg(pShape(FRAME, { kind: 'rightTriangle', fill: '#000000', flipH: true }))).toContain('scale(-1 1)');
    const line = shapeSvg(pShape(rect(0, 0, 100, 40), { kind: 'line', flipH: true }));
    expect(line).toMatch(/x1="100" y1="0" x2="0" y2="40"/);
  });

  it('dashArrayOf: múltiplos da espessura; ponta redonda mantém o período', () => {
    expect(dashArrayOf('dashed', 2)).toBe('8 6');
    expect(dashArrayOf('dotted', 2)).toBe('2 2');
    expect(dashArrayOf('dotted', 2, true)).toBe('0.001 4');
    expect(dashArrayOf('solid', 2)).toBeUndefined();
  });
});
