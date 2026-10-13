import { describe, expect, it } from 'vitest';
import { layoutDeck, layoutSlide } from '../../src/layout/index.ts';
import type { PositionedNode, PositionedSlide } from '../../src/core/types.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import {
  FAKE_IMAGE,
  FAKE_LINE_HEIGHT,
  SIZE_16X9,
  SIZE_4X3,
  createFakeEnv,
  rBox,
  rDeck,
  rImage,
  rShape,
  rSlide,
  rText,
  rect,
} from '../helpers/nodes.ts';

const abs = { position: 'absolute' } as const;

const child = (slide: PositionedSlide, ...indices: number[]): PositionedNode => {
  let node: { children?: readonly PositionedNode[] } = slide;
  let found: PositionedNode | undefined;
  for (const i of indices) {
    found = node.children?.[i];
    if (!found) throw new Error(`no child at ${indices.join('.')}`);
    node = found as { children?: readonly PositionedNode[] };
  }
  if (!found) throw new Error('no indices');
  return found;
};

const layout = (children: Parameters<typeof rSlide>[0], size = SIZE_16X9) => {
  const fake = createFakeEnv();
  const slide = layoutSlide(rSlide(children), size, fake.env);
  return { slide, ...fake };
};

describe('layoutSlide — slide', () => {
  it('gives the slide a frame equal to the slide size', () => {
    expect(layout([]).slide.frame).toEqual(rect(0, 0, 720, 405));
  });

  it('uses the given size (4x3)', () => {
    expect(layout([], SIZE_4X3).slide.frame).toEqual(rect(0, 0, 720, 540));
  });

  it('keeps kind, path and props of the slide', () => {
    const fake = createFakeEnv();
    const slide = layoutSlide(rSlide([], { background: '#ffffff', notes: 'n' }, 'CoverLayout'), SIZE_16X9, fake.env);
    expect(slide).toMatchObject({ kind: 'slide', path: 'CoverLayout', props: { background: '#ffffff', notes: 'n' } });
  });

  it('keeps children order, kinds and paths', () => {
    const { slide } = layout([
      rBox({ ...abs, width: 1, height: 1 }, [], 'Slide > Box'),
      rShape({ ...abs, kind: 'rect', width: 1, height: 1 }, 'Slide > Shape'),
    ]);
    expect(slide.children.map((c) => [c.kind, c.path])).toEqual([
      ['box', 'Slide > Box'],
      ['shape', 'Slide > Shape'],
    ]);
  });
});

describe('layoutSlide — absolute positioning', () => {
  it('places a node with left/top/width/height in pt', () => {
    const { slide } = layout([rBox({ ...abs, left: 10, top: 20, width: 100, height: 50 })]);
    expect(child(slide, 0).frame).toEqual(rect(10, 20, 100, 50));
  });

  it('places a node with right/bottom relative to the slide edges', () => {
    const { slide } = layout([rBox({ ...abs, right: 10, bottom: 20, width: 100, height: 50 })]);
    expect(child(slide, 0).frame).toEqual(rect(610, 335, 100, 50));
  });

  it('derives width/height from left+right and top+bottom', () => {
    const { slide } = layout([rBox({ ...abs, left: 10, right: 20, top: 5, bottom: 15 })]);
    expect(child(slide, 0).frame).toEqual(rect(10, 5, 690, 385));
  });

  it('resolves percentages against the slide', () => {
    const { slide } = layout([rBox({ ...abs, left: '10%', top: '20%', width: '50%', height: '20%' })]);
    expect(child(slide, 0).frame).toEqual(rect(72, 81, 360, 81));
  });

  it('accepts negative offsets', () => {
    const { slide } = layout([rBox({ ...abs, left: -10, top: -20, width: 100, height: 50 })]);
    expect(child(slide, 0).frame).toEqual(rect(-10, -20, 100, 50));
  });

  it('accepts negative right/bottom (overflowing the slide)', () => {
    const { slide } = layout([rBox({ ...abs, right: -10, bottom: -5, width: 100, height: 50 })]);
    expect(child(slide, 0).frame).toEqual(rect(630, 360, 100, 50));
  });

  it('positions shapes', () => {
    const { slide } = layout([rShape({ ...abs, kind: 'ellipse', left: 1, top: 2, width: 3, height: 4 })]);
    expect(child(slide, 0).frame).toEqual(rect(1, 2, 3, 4));
  });
});

describe('layoutSlide — nesting', () => {
  it('returns frames absolute on the slide (child offsets add to the parent)', () => {
    const { slide } = layout([
      rBox({ ...abs, left: 100, top: 50, width: 200, height: 100 }, [
        rBox({ ...abs, left: 10, top: 20, width: 30, height: 40 }),
      ]),
    ]);
    expect(child(slide, 0).frame).toEqual(rect(100, 50, 200, 100));
    expect(child(slide, 0, 0).frame).toEqual(rect(110, 70, 30, 40));
  });

  it('adds offsets across three levels', () => {
    const { slide } = layout([
      rBox({ ...abs, left: 100, top: 100, width: 300, height: 200 }, [
        rBox({ ...abs, left: 10, top: 10, width: 100, height: 100 }, [
          rShape({ ...abs, kind: 'rect', left: 1, top: 2, width: 5, height: 5 }),
        ]),
      ]),
    ]);
    expect(child(slide, 0, 0, 0).frame).toEqual(rect(111, 112, 5, 5));
  });

  it('resolves percentages against the parent box', () => {
    const { slide } = layout([
      rBox({ ...abs, left: 100, top: 50, width: 200, height: 100 }, [
        rBox({ ...abs, left: '10%', top: 10, width: '50%', height: '50%' }),
      ]),
    ]);
    expect(child(slide, 0, 0).frame).toEqual(rect(120, 60, 100, 50));
  });

  it('resolves right/bottom against the parent box', () => {
    const { slide } = layout([
      rBox({ ...abs, left: 100, top: 50, width: 200, height: 100 }, [
        rBox({ ...abs, right: 10, bottom: 10, width: 50, height: 20 }),
      ]),
    ]);
    expect(child(slide, 0, 0).frame).toEqual(rect(240, 120, 50, 20));
  });

  it('places nested children with negative offsets outside the parent', () => {
    const { slide } = layout([
      rBox({ ...abs, left: 100, top: 50, width: 200, height: 100 }, [
        rBox({ ...abs, left: -20, top: -10, width: 10, height: 10 }),
      ]),
    ]);
    expect(child(slide, 0, 0).frame).toEqual(rect(80, 40, 10, 10));
  });
});

describe('layoutSlide — text', () => {
  it('uses measureText height when the text has no height', () => {
    const { slide } = layout([rText('one\ntwo', { ...abs, left: 10, top: 10, width: 200 })]);
    expect(child(slide, 0).frame).toEqual(rect(10, 10, 200, 2 * FAKE_LINE_HEIGHT));
  });

  it('measures with the style derived from props and the frame width', () => {
    const props = { ...abs, left: 0, top: 0, width: 200, size: 24, weight: 'bold', font: 'Inter' } as const;
    const { measureCalls } = layout([rText('hello', props)]);
    expect(measureCalls.length).toBeGreaterThan(0);
    const last = measureCalls[measureCalls.length - 1];
    expect(last).toMatchObject({ content: 'hello', style: textStyleOf(props), maxWidth: 200 });
  });

  it('passes maxLines to the measurer', () => {
    const { measureCalls } = layout([rText('x', { ...abs, width: 100, maxLines: 2 })]);
    expect(measureCalls[measureCalls.length - 1]?.maxLines).toBe(2);
  });

  it('keeps an explicit height', () => {
    const { slide } = layout([rText('one\ntwo', { ...abs, left: 0, top: 0, width: 200, height: 100 })]);
    expect(child(slide, 0).frame).toEqual(rect(0, 0, 200, 100));
  });

  it('stores the TextLayout from the measurer on the positioned text', () => {
    const { slide } = layout([rText('a\nb\nc', { ...abs, width: 200, size: 30 })]);
    const node = child(slide, 0);
    expect(node.kind).toBe('text');
    if (node.kind !== 'text') return;
    expect(node.content).toBe('a\nb\nc');
    expect(node.text.lines).toEqual(['a', 'b', 'c']);
    expect(node.text.height).toBe(3 * FAKE_LINE_HEIGHT);
    expect(node.text.fontSize).toBe(30);
  });

  it('measures text inside an absolute box at its absolute position', () => {
    const { slide } = layout([
      rBox({ ...abs, left: 50, top: 60, width: 300, height: 200 }, [rText('x', { ...abs, left: 5, top: 5, width: 100 })]),
    ]);
    expect(child(slide, 0, 0).frame).toEqual(rect(55, 65, 100, FAKE_LINE_HEIGHT));
  });
});

describe('layoutSlide — images', () => {
  it('asks env.imageSize for the src and stores intrinsic dimensions', () => {
    const { slide, imageCalls } = layout([rImage({ ...abs, src: 'pic.png', width: 100, height: 100 })]);
    expect(imageCalls).toContain('pic.png');
    const node = child(slide, 0);
    expect(node.kind === 'image' && node.intrinsic).toEqual(FAKE_IMAGE);
  });

  it('keeps both dimensions when given', () => {
    const { slide } = layout([rImage({ ...abs, src: 'pic.png', left: 1, top: 2, width: 100, height: 100 })]);
    expect(child(slide, 0).frame).toEqual(rect(1, 2, 100, 100));
  });

  it('derives height from width using the aspect ratio', () => {
    const { slide } = layout([rImage({ ...abs, src: 'pic.png', left: 0, top: 0, width: 200 })]);
    expect(child(slide, 0).frame).toEqual(rect(0, 0, 200, 100));
  });

  it('derives width from height using the aspect ratio', () => {
    const { slide } = layout([rImage({ ...abs, src: 'pic.png', left: 0, top: 0, height: 50 })]);
    expect(child(slide, 0).frame).toEqual(rect(0, 0, 100, 50));
  });

  it('uses the natural size in pt (px × 0.75) without dimensions', () => {
    const { slide } = layout([rImage({ ...abs, src: 'pic.png', left: 10, top: 20 })]);
    expect(child(slide, 0).frame).toEqual(rect(10, 20, 300, 150));
  });
});

describe('layoutDeck', () => {
  it('lays out every slide and carries the size', () => {
    const fake = createFakeEnv();
    const deck = layoutDeck(
      rDeck(rSlide([rBox({ ...abs, left: 1, top: 1, width: 1, height: 1 })]), rSlide()),
      SIZE_4X3,
      fake.env,
    );
    expect(deck.size).toEqual(SIZE_4X3);
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides.map((s) => s.frame)).toEqual([rect(0, 0, 720, 540), rect(0, 0, 720, 540)]);
    expect(deck.slides[0]?.children[0]?.frame).toEqual(rect(1, 1, 1, 1));
  });

  it('does not mutate the resolved input', () => {
    const fake = createFakeEnv();
    const input = rDeck(rSlide([rBox({ ...abs, left: 1, top: 1, width: 1, height: 1 })]));
    const snapshot = JSON.parse(JSON.stringify(input));
    layoutDeck(input, SIZE_16X9, fake.env);
    expect(input).toEqual(snapshot);
  });
});
