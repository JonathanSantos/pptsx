import { describe, expect, it } from 'vitest';
import { detectOverflow, type Overflow } from '../../src/fit/index.ts';
import type { PositionedNode } from '../../src/core/types.ts';
import { fakeParagraphLayout, pBox, pShape, pSlide, pText, rect } from '../helpers/nodes.ts';

/** fakeParagraphLayout: 20 pt por linha. */
const lines = (n: number) => fakeParagraphLayout([Array.from({ length: n }, (_, i) => `l${i}`)]);
const withPath = <N extends PositionedNode>(node: N, path: string): N => ({ ...node, path });
const ofKind = (list: readonly Overflow[], kind: Overflow['kind']) => list.filter((o) => o.kind === kind);
const shape = (x: number, y: number, w: number, h: number, path = 'Slide > Box > Shape') =>
  withPath(pShape(rect(x, y, w, h), { kind: 'rect' }), path);

describe('detectOverflow — text', () => {
  it('reports text.height > frame.height with overflowPt and overflowPct', () => {
    const t = withPath(pText(rect(0, 0, 200, 30), 'x', {}, lines(2)), 'Slide > Text');
    const out = detectOverflow(pSlide([t]));
    expect(out).toHaveLength(1);
    const o = out[0]!;
    expect(o.kind).toBe('text');
    expect(o.path).toBe('Slide > Text');
    expect(o.overflowPt).toBeCloseTo(10, 6);
    expect(o.overflowPct).toBeCloseTo((10 / 30) * 100, 6);
  });

  it('does not report within the 0.5 pt tolerance', () => {
    const t = pText(rect(0, 0, 200, 39.6), 'x', {}, lines(2));
    expect(detectOverflow(pSlide([t]))).toEqual([]);
  });

  it('reports just past the tolerance', () => {
    const t = pText(rect(0, 0, 200, 39.4), 'x', {}, lines(2));
    const out = ofKind(detectOverflow(pSlide([t])), 'text');
    expect(out).toHaveLength(1);
    expect(out[0]!.overflowPt).toBeCloseTo(0.6, 6);
  });

  it('frame.height 0 → overflowPct 100', () => {
    const t = pText(rect(0, 0, 200, 0), 'x', {}, lines(1));
    const o = ofKind(detectOverflow(pSlide([t])), 'text')[0]!;
    expect(o.overflowPt).toBeCloseTo(20, 6);
    expect(o.overflowPct).toBe(100);
  });

  it('finds texts nested in boxes, with the node path', () => {
    const t = withPath(pText(rect(10, 10, 100, 20), 'x', {}, lines(3)), 'Slide > Bullets > Text[1]');
    const box = withPath(pBox(rect(0, 0, 200, 100), {}, [t]), 'Slide > Bullets');
    const out = detectOverflow(pSlide([box]));
    expect(out).toEqual([expect.objectContaining({ kind: 'text', path: 'Slide > Bullets > Text[1]' })]);
    expect(out[0]!.overflowPt).toBeCloseTo(40, 6);
    expect(out[0]!.overflowPct).toBeCloseTo(200, 6);
  });

  it('text squeezed inside a box reports only the text (not the box)', () => {
    const t = pText(rect(0, 0, 200, 50), 'x', {}, lines(3));
    const out = detectOverflow(pSlide([pBox(rect(0, 0, 200, 50), {}, [t])]));
    expect(out.map((o) => o.kind)).toEqual(['text']);
  });
});

describe('detectOverflow — box', () => {
  it('vertical: fixed-size in-flow children past the content area (considering padding)', () => {
    // Conteúdo: y 10..90. Filhos terminam em 95: estoura 5 pt só por causa do padding.
    const box = withPath(
      pBox(rect(0, 0, 200, 100), { padding: 10 }, [shape(10, 10, 180, 50), shape(10, 60, 180, 35)]),
      'Slide > Card',
    );
    const out = detectOverflow(pSlide([box]));
    const boxes = ofKind(out, 'box');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.path).toBe('Slide > Card');
    expect(boxes[0]!.overflowPt).toBeCloseTo(5, 6);
    expect(boxes[0]!.overflowPct).toBeGreaterThan(0);
    expect(ofKind(out, 'text')).toHaveLength(0);
  });

  it('horizontal: row children past the content area', () => {
    // Conteúdo: x 10..190. Filhos terminam em 200: estoura 10 pt.
    const box = pBox(rect(0, 0, 200, 100), { padding: 10, direction: 'row' }, [
      shape(10, 10, 100, 80),
      shape(110, 10, 90, 80),
    ]);
    const boxes = ofKind(detectOverflow(pSlide([box])), 'box');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.overflowPt).toBeCloseTo(10, 6);
  });

  it('same children without padding fit → nothing reported', () => {
    const box = pBox(rect(0, 0, 200, 100), {}, [shape(0, 0, 200, 50), shape(0, 50, 200, 45)]);
    expect(detectOverflow(pSlide([box]))).toEqual([]);
  });

  it('within tolerance is not reported', () => {
    const box = pBox(rect(0, 0, 200, 100), {}, [shape(0, 0, 200, 100.4)]);
    expect(detectOverflow(pSlide([box]))).toEqual([]);
  });

  it('the slide itself is a container: padding defines its content area', () => {
    const s = shape(20, 20, 680, 375, 'Slide > Shape'); // conteúdo vai até 385; termina em 395
    const out = detectOverflow(pSlide([s], { padding: 20 }));
    const boxes = ofKind(out, 'box');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.path).toBe('Slide');
    expect(boxes[0]!.overflowPt).toBeCloseTo(10, 6);
    expect(ofKind(out, 'slide')).toHaveLength(0);
  });

  it('absolute children never make the parent overflow', () => {
    const deco = withPath(pShape(rect(150, 80, 100, 100), { kind: 'rect', position: 'absolute' }), 'Slide > Box > Shape');
    const box = pBox(rect(0, 0, 200, 100), {}, [deco]);
    expect(detectOverflow(pSlide([box]))).toEqual([]);
  });
});

describe('detectOverflow — slide', () => {
  it('in-flow node past the bottom of the slide', () => {
    const s = shape(0, 380, 100, 50, 'Slide > Footer');
    const out = ofKind(detectOverflow(pSlide([s])), 'slide');
    expect(out).toHaveLength(1);
    expect(out[0]!.path).toBe('Slide > Footer');
    expect(out[0]!.overflowPt).toBeCloseTo(25, 6);
  });

  it('in-flow node past the left edge', () => {
    const s = shape(-10, 0, 100, 50, 'Slide > Shape');
    const out = ofKind(detectOverflow(pSlide([s])), 'slide');
    expect(out).toHaveLength(1);
    expect(out[0]!.overflowPt).toBeCloseTo(10, 6);
  });

  it('nested node outside the slide inside a Box that overflows → only box on the Box, no slide', () => {
    const inner = shape(650, 0, 100, 50, 'Slide > Box > Shape');
    const box = withPath(pBox(rect(600, 0, 120, 100), { direction: 'row' }, [inner]), 'Slide > Box');
    const out = detectOverflow(pSlide([box]));
    expect(ofKind(out, 'slide')).toEqual([]);
    const boxes = ofKind(out, 'box');
    expect(boxes.map((o) => o.path)).toEqual(['Slide > Box']);
    expect(boxes[0]!.overflowPt).toBeCloseTo(30, 6);
  });

  it('nested out-of-slide where the Box does not overflow (Box itself off the page) → slide, no box', () => {
    const inner = shape(700, 0, 80, 50, 'Slide > Box > Shape');
    const box = withPath(pBox(rect(700, 0, 100, 100), { direction: 'row' }, [inner]), 'Slide > Box');
    const out = detectOverflow(pSlide([box]));
    expect(ofKind(out, 'box')).toEqual([]);
    const slides = ofKind(out, 'slide');
    expect(slides.length).toBeGreaterThanOrEqual(1);
    expect(['Slide > Box', 'Slide > Box > Shape']).toContain(slides[0]!.path);
    expect(slides[0]!.overflowPt).toBeGreaterThan(0);
  });

  it('at Slide level what leaves the page is slide, not box of the Slide (even with padding)', () => {
    const s = shape(20, 380, 100, 50, 'Slide > Footer'); // passa do padding e da página
    const out = detectOverflow(pSlide([s], { padding: 20 }));
    expect(ofKind(out, 'slide').map((o) => o.path)).toEqual(['Slide > Footer']);
    expect(ofKind(out, 'box')).toEqual([]);
  });

  it('absolute node and its descendants outside the slide → nothing', () => {
    const deco = pBox(rect(-50, -50, 100, 100), { position: 'absolute' }, [
      shape(-80, -80, 300, 300, 'Slide > Box > Shape'),
      shape(600, 350, 300, 300, 'Slide > Box > Shape'),
    ]);
    expect(detectOverflow(pSlide([deco]))).toEqual([]);
  });

  it('absolute node never generates box/slide (deeply nested)', () => {
    const deco = pBox(rect(500, 300, 300, 200), { position: 'absolute' }, [
      pBox(rect(500, 300, 50, 50), {}, [shape(500, 300, 400, 400)]),
    ]);
    const kinds = detectOverflow(pSlide([deco])).map((o) => o.kind);
    expect(kinds).not.toContain('box');
    expect(kinds).not.toContain('slide');
  });
});

describe('detectOverflow — no overflow', () => {
  it('slide without overflow → []', () => {
    const t = pText(rect(40, 40, 300, 40), 'x', {}, lines(2));
    const box = pBox(rect(20, 20, 400, 200), { padding: 20 }, [t, shape(40, 80, 300, 100)]);
    expect(detectOverflow(pSlide([box]))).toEqual([]);
  });

  it('empty slide → []', () => {
    expect(detectOverflow(pSlide([]))).toEqual([]);
  });

  it('is pure: input not mutated, same output twice', () => {
    const slide = pSlide([pText(rect(0, 0, 200, 30), 'x', {}, lines(2))]);
    const snapshot = structuredClone(slide);
    const a = detectOverflow(slide);
    const b = detectOverflow(slide);
    expect(a).toEqual(b);
    expect(slide).toEqual(snapshot);
  });
});
