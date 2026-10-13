import { describe, expect, it } from 'vitest';
import { slideToSvg, type SvgOptions } from '../../src/preview/index.ts';
import type { PositionedNode, Rect, TextLayout } from '../../src/core/types.ts';
import { SIZE_16X9, pBox, pShape, pSlide, pText, rect } from '../helpers/nodes.ts';
import { findElements, isRed, num, styleOf, type SvgElement } from '../helpers/svg.ts';

/**
 * M4-B: no debug, o texto cujo text.height passa do frame (além de
 * DEFAULTS.fit.epsilon) ganha uma faixa vermelha translúcida na área estourada;
 * a área "fora do pai" ignora nós absolutos e seus descendentes.
 */
const options = (over: Partial<SvgOptions> = {}): SvgOptions => ({
  widthPx: 1280,
  baseDir: '/base',
  readFile: () => Buffer.alloc(0),
  ...over,
});

const svgOf = (children: readonly PositionedNode[], debug: boolean) =>
  slideToSvg(pSlide(children), SIZE_16X9, options({ debug }));

const layout = (lineCount: number, lineHeight = 20): TextLayout => {
  const lines = Array.from({ length: lineCount }, (_, i) => `linha ${i}`);
  return {
    lines,
    paragraphs: [lines],
    fontSize: 18,
    lineHeight,
    ascent: 16,
    width: 100,
    height: lineCount * lineHeight,
    truncated: false,
    fontMissing: false,
  };
};

/** Retângulos com preenchimento vermelho visível. */
const redFills = (svg: string): SvgElement[] =>
  findElements(svg, 'rect').filter((r) => isRed(styleOf(r, 'fill')));

const covers = (el: SvgElement, area: Rect, tol = 0.01): boolean => {
  const x = num(el.attrs.x);
  const y = num(el.attrs.y);
  const w = num(el.attrs.width);
  const h = num(el.attrs.height);
  return (
    x <= area.x + tol &&
    y <= area.y + tol &&
    x + w >= area.x + area.width - tol &&
    y + h >= area.y + area.height - tol
  );
};

describe('preview debug — text overflow band', () => {
  // Texto de 5 linhas × 20 pt = 100 pt numa caixa de 60 pt, dentro do slide e do pai.
  const overflowing = () => pText(rect(50, 50, 200, 60), 'x', {}, layout(5));

  it('draws a red band over the overflowing area (frame bottom → frame.y + text.height)', () => {
    const svg = svgOf([overflowing()], true);
    const band: Rect = { x: 50, y: 110, width: 200, height: 40 };
    const hits = redFills(svg).filter((r) => covers(r, band));
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('the band does not cover the area above the frame top', () => {
    const svg = svgOf([overflowing()], true);
    const band: Rect = { x: 50, y: 110, width: 200, height: 40 };
    const hit = redFills(svg).find((r) => covers(r, band))!;
    expect(num(hit.attrs.y)).toBeGreaterThanOrEqual(50 - 0.01);
  });

  it('the band is translucent (text stays readable)', () => {
    const svg = svgOf([overflowing()], true);
    const band: Rect = { x: 50, y: 110, width: 200, height: 40 };
    const hit = redFills(svg).find((r) => covers(r, band))!;
    const opacity = styleOf(hit, 'fill-opacity') ?? styleOf(hit, 'opacity');
    expect(opacity).toBeDefined();
    expect(Number(opacity)).toBeLessThan(1);
  });

  it('does not draw a band when the text fits', () => {
    const svg = svgOf([pText(rect(50, 50, 200, 60), 'x', {}, layout(3))], true);
    expect(redFills(svg)).toHaveLength(0);
  });

  it('does not draw a band when the overflow is within the 0.5 pt tolerance', () => {
    const svg = svgOf([pText(rect(50, 50, 200, 59.7), 'x', {}, layout(3))], true);
    expect(redFills(svg)).toHaveLength(0);
  });

  it('without debug draws no band', () => {
    expect(redFills(svgOf([overflowing()], false))).toHaveLength(0);
  });

  it('works for a text nested in a box', () => {
    const svg = svgOf([pBox(rect(0, 0, 400, 300), {}, [overflowing()])], true);
    const band: Rect = { x: 50, y: 110, width: 200, height: 40 };
    expect(redFills(svg).some((r) => covers(r, band))).toBe(true);
  });
});

describe('preview debug — outside parent', () => {
  it('in-flow child past its parent gets a red area', () => {
    const svg = svgOf([pBox(rect(0, 0, 100, 100), {}, [pShape(rect(0, 50, 100, 100), { kind: 'rect' })])], true);
    expect(redFills(svg).some((r) => covers(r, { x: 0, y: 100, width: 100, height: 50 }))).toBe(true);
  });

  it('absolute node past its parent gets no red area', () => {
    const svg = svgOf(
      [pBox(rect(0, 0, 100, 100), {}, [pShape(rect(0, 50, 100, 100), { kind: 'rect', position: 'absolute' })])],
      true,
    );
    expect(redFills(svg)).toHaveLength(0);
  });

  it('descendants of an absolute node get no red area', () => {
    const deco = pBox(rect(-50, -50, 100, 100), { position: 'absolute' }, [
      pShape(rect(-80, -80, 300, 300), { kind: 'rect' }),
    ]);
    expect(redFills(svgOf([deco], true))).toHaveLength(0);
  });
});
