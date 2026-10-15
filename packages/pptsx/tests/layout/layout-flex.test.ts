import { describe, expect, it } from 'vitest';
import { layoutDeck, layoutSlide } from '../../src/layout/index.ts';
import type { LayoutEnv, ResolvedNode, ResolvedSlide, SlideProps, TextMeasureInput } from '../../src/core/types.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import {
  FAKE_LINE_HEIGHT,
  SIZE_16X9,
  createFakeEnv,
  fakeTextLayout,
  rBox,
  rDeck,
  rImage,
  rShape,
  rSlide,
  rText,
  rect,
} from '../helpers/nodes.ts';
import { child, expectFrame } from '../helpers/positioned.ts';

const abs = { position: 'absolute' } as const;

const layout = (children: readonly ResolvedNode[], props: Omit<SlideProps, 'children'> = {}) => {
  const fake = createFakeEnv();
  const slide = layoutSlide(rSlide(children, props), SIZE_16X9, fake.env);
  return { slide, ...fake };
};

/** Medidor falso que devolve a largura recebida dentro da linha, para provar com que largura foi medido. */
const widthEchoEnv = () => {
  const calls: TextMeasureInput[] = [];
  const env: LayoutEnv = {
    measureText: (input) => {
      calls.push(input);
      return { ...fakeTextLayout(input.content, input.style.size), lines: [`w=${input.maxWidth}`] };
    },
    imageSize: () => ({ width: 400, height: 200 }),
  };
  return { env, calls };
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const sized = (width: number, height: number) => rBox({ width, height });

describe('layout flex — column (default direction)', () => {
  it('stacks in-flow children vertically and stretches them to the slide width', () => {
    const { slide } = layout([rBox({ height: 50 }), rBox({ height: 70 })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 50));
    expectFrame(child(slide, 1).frame, rect(0, 50, 720, 70));
  });

  it('gives an empty in-flow box without height a height of 0 (not the whole parent)', () => {
    const { slide } = layout([rBox()]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 0));
  });

  it('applies gap between column children', () => {
    const { slide } = layout([rBox({ gap: 10 }, [rBox({ height: 50 }), rBox({ height: 70 })])]);
    expectFrame(child(slide, 0, 1).frame, rect(0, 60, 720, 70));
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 130));
  });

  it('applies gap on the slide itself', () => {
    const { slide } = layout([rBox({ height: 10 }), rBox({ height: 10 })], { gap: 15 });
    expectFrame(child(slide, 1).frame, rect(0, 25, 720, 10));
  });
});

describe('layout flex — row', () => {
  it('splits the width between two grow=1 children, minus the gap', () => {
    const { slide } = layout([
      rBox({ direction: 'row', gap: 20, height: 100 }, [rBox({ grow: 1 }), rBox({ grow: 1 })]),
    ]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 350, 100));
    expectFrame(child(slide, 0, 1).frame, rect(370, 0, 350, 100));
  });

  it('distributes free space proportionally to grow', () => {
    const { slide } = layout([
      rBox({ direction: 'row', gap: 20, height: 100 }, [rBox({ grow: 1 }), rBox({ grow: 3 })]),
    ]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(175);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(525);
    expect(child(slide, 0, 1).frame.x).toBeCloseTo(195);
  });

  it('grow={1} siblings get equal sizes regardless of their content (flex-basis 0)', () => {
    const { slide } = layout([
      rBox({ direction: 'row', height: 100 }, [rBox({ grow: 1 }, [rBox({ width: 300, height: 10 })]), rBox({ grow: 1 })]),
    ]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(360);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(360);
  });

  it('grow={1} texts in a row get equal widths regardless of the measured width', () => {
    const { slide } = layout([rBox({ direction: 'row' }, [rText('short', { grow: 1 }), rText('a\nb\nc', { grow: 1 })])]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(360);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(360);
  });

  it('flexGrow with an explicit main-axis size adds to that size (basis auto = the size)', () => {
    const sized120 = rBox({ width: 120 });
    const grown = { ...sized120, css: { ...sized120.css, flexGrow: 1 } };
    const { slide } = layout([
      rBox({ direction: 'row', height: 10 }, [grown, rBox({ grow: 1 })]),
    ]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(420);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(300);
  });

  it('places fixed-size children side by side', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 100 }, [sized(100, 30), sized(50, 40)])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 100, 30));
    expectFrame(child(slide, 0, 1).frame, rect(100, 0, 50, 40));
  });

  it('accepts direction on the slide', () => {
    const { slide } = layout([sized(100, 30), sized(50, 40)], { direction: 'row' });
    expectFrame(child(slide, 1).frame, rect(100, 0, 50, 40));
  });
});

describe('layout flex — padding', () => {
  it('insets children by a numeric padding on all sides', () => {
    const { slide } = layout([rBox({ padding: 20, height: 200 }, [rBox({ height: 50 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(20, 20, 680, 50));
  });

  it('insets children by an object padding (missing sides = 0)', () => {
    const { slide } = layout([rBox({ padding: { top: 10, left: 30, right: 5 }, height: 100 }, [rBox({ height: 20 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(30, 10, 685, 20));
  });

  it('respects bottom padding when justifying to the end', () => {
    const { slide } = layout([rBox({ padding: { bottom: 15 }, height: 100, justify: 'end' }, [rBox({ height: 20 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 65, 720, 20));
  });

  it('grows a box without height to fit padding + content', () => {
    const { slide } = layout([rBox({ padding: 10 }, [rBox({ height: 30 })])]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 50));
  });

  it('applies slide padding to in-flow children', () => {
    const { slide } = layout([rBox({ height: 50 })], { padding: 20 });
    expectFrame(child(slide, 0).frame, rect(20, 20, 680, 50));
  });
});

describe('layout flex — align (cross axis)', () => {
  const alignCase = (align: 'start' | 'center' | 'end') =>
    child(layout([rBox({ align }, [sized(100, 20)])]).slide, 0, 0).frame;

  it('align="start" puts children at the cross-axis start', () => {
    expectFrame(alignCase('start'), rect(0, 0, 100, 20));
  });

  it('align="center" centers children on the cross axis', () => {
    expectFrame(alignCase('center'), rect(310, 0, 100, 20));
  });

  it('align="end" puts children at the cross-axis end', () => {
    expectFrame(alignCase('end'), rect(620, 0, 100, 20));
  });

  it('align="stretch" stretches children without cross size', () => {
    const { slide } = layout([rBox({ align: 'stretch' }, [rBox({ height: 20 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 720, 20));
  });

  it('align="stretch" does not override an explicit cross size', () => {
    const { slide } = layout([rBox({ align: 'stretch' }, [sized(100, 20)])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 100, 20));
  });

  it('in a row, align="center" centers vertically', () => {
    const { slide } = layout([rBox({ direction: 'row', align: 'center', height: 100 }, [sized(50, 20)])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 40, 50, 20));
  });

  it('in a row, the default (stretch) fills the container height', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 100 }, [rBox({ width: 50 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 50, 100));
  });
});

describe('layout flex — justify (main axis)', () => {
  const justifyCase = (justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly') => {
    const { slide } = layout([rBox({ height: 300, justify }, [rBox({ height: 50 }), rBox({ height: 50 })])]);
    return [child(slide, 0, 0).frame.y, child(slide, 0, 1).frame.y];
  };

  it.each([
    ['start', 0, 50],
    ['center', 100, 150],
    ['end', 200, 250],
    ['between', 0, 250],
    ['around', 50, 200],
    ['evenly', 200 / 3, 50 + 400 / 3],
  ] as const)('justify="%s" places the children at y=%d and y=%d', (justify, y0, y1) => {
    const [a, b] = justifyCase(justify);
    expect(a).toBeCloseTo(y0);
    expect(b).toBeCloseTo(y1);
  });

  it('justify works along the row axis', () => {
    const { slide } = layout([rBox({ direction: 'row', justify: 'end', height: 10 }, [rBox({ width: 100 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(620, 0, 100, 10));
  });
});

describe('layout flex — sizes in %', () => {
  it('resolves width/height percentages against the slide', () => {
    const { slide } = layout([rBox({ width: '50%', height: '25%' })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 360, 101.25));
  });

  it('resolves percentages against the parent box', () => {
    const { slide } = layout([rBox({ width: 400, height: 200 }, [rBox({ width: '25%', height: '50%' })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 100, 100));
  });
});

describe('layout flex — min/max', () => {
  it('maxWidth caps a growing child', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 10 }, [rBox({ grow: 1, maxWidth: 200 })])]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(200);
  });

  it('minWidth raises a smaller width', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 10 }, [rBox({ width: 50, minWidth: 120 })])]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(120);
  });

  it('minHeight raises a smaller height', () => {
    const { slide } = layout([rBox({ height: 10, minHeight: 40 })]);
    expect(child(slide, 0).frame.height).toBeCloseTo(40);
  });

  it('maxHeight in % caps the height', () => {
    const { slide } = layout([rBox({ height: 100, maxHeight: '10%' })]);
    expect(child(slide, 0).frame.height).toBeCloseTo(40.5);
  });

  it('maxWidth caps a stretched child', () => {
    const { slide } = layout([rBox({ height: 10, maxWidth: 300 })]);
    expect(child(slide, 0).frame.width).toBeCloseTo(300);
  });
});

describe('layout flex — shrink', () => {
  it('shrinks by default (shrink = 1, like CSS) when children overflow', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 10 }, [rBox({ width: 500 }), rBox({ width: 500 })])]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(360);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(360);
  });

  it('shrinks proportionally to shrink × base size', () => {
    const { slide } = layout([
      rBox({ direction: 'row', height: 10 }, [rBox({ width: 600, shrink: 1 }), rBox({ width: 400, shrink: 2 })]),
    ]);
    // excesso 280 repartido por 600×1 : 400×2 → 120 e 160
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(480);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(240);
  });

  it('shrinks overflowing children with shrink=1 equally', () => {
    const { slide } = layout([
      rBox({ direction: 'row', height: 10 }, [rBox({ width: 500, shrink: 1 }), rBox({ width: 500, shrink: 1 })]),
    ]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(360);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(360);
    expect(child(slide, 0, 1).frame.x).toBeCloseTo(360);
  });

  it('only the child with shrink > 0 absorbs the overflow', () => {
    const { slide } = layout([
      rBox({ direction: 'row', height: 10 }, [rBox({ width: 500, shrink: 1 }), rBox({ width: 500, shrink: 0 })]),
    ]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(220);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(500);
  });
});

describe('layout flex — alignSelf', () => {
  it('alignSelf overrides the parent align', () => {
    const { slide } = layout([rBox({ align: 'start' }, [rBox({ width: 100, height: 10, alignSelf: 'end' })])]);
    expectFrame(child(slide, 0, 0).frame, rect(620, 0, 100, 10));
  });

  it('alignSelf="center" centers a single child', () => {
    const { slide } = layout([rBox({ align: 'start' }, [rBox({ width: 100, height: 10, alignSelf: 'center' })])]);
    expect(child(slide, 0, 0).frame.x).toBeCloseTo(310);
  });

  it('alignSelf="stretch" stretches even when the parent aligns to start', () => {
    const { slide } = layout([rBox({ align: 'start' }, [rBox({ height: 10, alignSelf: 'stretch' })])]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(720);
  });
});

describe('layout flex — absolute positioning', () => {
  it('places with top/left in pt', () => {
    const { slide } = layout([rBox({ ...abs, top: 30, left: 40, width: 10, height: 10 })]);
    expectFrame(child(slide, 0).frame, rect(40, 30, 10, 10));
  });

  it('places with right/bottom in %', () => {
    const { slide } = layout([rBox({ ...abs, right: '10%', bottom: '10%', width: 100, height: 50 })]);
    expectFrame(child(slide, 0).frame, rect(548, 314.5, 100, 50));
  });

  it('accepts negative percentages', () => {
    const { slide } = layout([rBox({ ...abs, left: '-10%', top: '-10%', width: 100, height: 50 })]);
    expectFrame(child(slide, 0).frame, rect(-72, -40.5, 100, 50));
  });

  it('derives width from left+right (in %)', () => {
    const { slide } = layout([rBox({ ...abs, left: '10%', right: '10%', top: 0, height: 20 })]);
    expectFrame(child(slide, 0).frame, rect(72, 0, 576, 20));
  });

  it('derives height from top+bottom with negative values', () => {
    const { slide } = layout([rBox({ ...abs, left: 0, width: 10, top: -10, bottom: -20 })]);
    expectFrame(child(slide, 0).frame, rect(0, -10, 10, 435));
  });

  it('measures offsets from the parent padding box (CSS semantics), ignoring padding', () => {
    const { slide } = layout([rBox({ ...abs, left: 10, top: 10, width: 5, height: 5 })], { padding: 40 });
    expectFrame(child(slide, 0).frame, rect(10, 10, 5, 5));
  });

  it('accumulates offsets across three levels (flow + padding + absolute)', () => {
    const { slide } = layout(
      [
        rBox({ padding: 20, height: 200 }, [
          rBox({ height: 20 }),
          rBox({ padding: 5, height: 100 }, [
            rBox({ height: 10 }),
            rBox({ ...abs, left: 1, top: 2, width: 3, height: 4 }),
          ]),
        ]),
      ],
      { padding: 10 },
    );
    expectFrame(child(slide, 0).frame, rect(10, 10, 700, 200));
    expectFrame(child(slide, 0, 1).frame, rect(30, 50, 660, 100));
    expectFrame(child(slide, 0, 1, 0).frame, rect(35, 55, 650, 10));
    expectFrame(child(slide, 0, 1, 1).frame, rect(31, 52, 3, 4));
  });
});

describe('layout flex — text in flow', () => {
  it('takes the measured height and the stretched width', () => {
    const { slide } = layout([rText('one\ntwo')]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 2 * FAKE_LINE_HEIGHT));
  });

  it('pushes the next sibling down by the measured height', () => {
    const { slide } = layout([rText('a\nb\nc'), rBox({ height: 10 })]);
    expectFrame(child(slide, 1).frame, rect(0, 3 * FAKE_LINE_HEIGHT, 720, 10));
  });

  it('calls measureText with the available width and the style from props', () => {
    const props = { size: 24, weight: 'bold', font: 'Inter' } as const;
    const { measureCalls } = layout([rBox({ padding: 20 }, [rText('hello', props)])]);
    expect(measureCalls.length).toBeGreaterThan(0);
    expect(measureCalls.every((c) => c.content === 'hello')).toBe(true);
    expect(measureCalls.some((c) => c.maxWidth === 680)).toBe(true);
    expect(measureCalls[measureCalls.length - 1]).toMatchObject({ style: textStyleOf(props), maxWidth: 680 });
  });

  it('passes maxLines through', () => {
    const { measureCalls } = layout([rText('x', { maxLines: 3 })]);
    expect(measureCalls.every((c) => c.maxLines === 3)).toBe(true);
  });

  it('stores in PositionedText.text the layout measured with the final frame width (grow in a row)', () => {
    const { env } = widthEchoEnv();
    const slide = layoutSlide(
      rSlide([rBox({ direction: 'row', height: 100 }, [rBox({ width: 100 }), rText('x', { grow: 1 })])]),
      SIZE_16X9,
      env,
    );
    const node = child(slide, 0, 1);
    expect(node.frame.width).toBeCloseTo(620);
    expect(node.kind === 'text' && node.text.lines).toEqual(['w=620']);
  });

  it('shrinks to the measured width in a row and re-measures with it', () => {
    const { env } = widthEchoEnv();
    const slide = layoutSlide(
      rSlide([rBox({ direction: 'row', align: 'start', height: 100 }, [rText('x')])]),
      SIZE_16X9,
      env,
    );
    const node = child(slide, 0, 0);
    expectFrame(node.frame, rect(0, 0, 100, FAKE_LINE_HEIGHT));
    expect(node.kind === 'text' && node.text.lines).toEqual(['w=100']);
  });

  it('centers a text by its measured width with align="center"', () => {
    const { slide } = layout([rBox({ align: 'center' }, [rText('x')])]);
    expectFrame(child(slide, 0, 0).frame, rect(310, 0, 100, FAKE_LINE_HEIGHT));
  });

  it('a text with a fixed width is measured with that width', () => {
    const { slide, measureCalls } = layout([rText('x', { width: 200 })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 200, FAKE_LINE_HEIGHT));
    expect(measureCalls[measureCalls.length - 1]?.maxWidth).toBe(200);
  });

  it('a text with fixed width and height keeps both', () => {
    const { slide } = layout([rText('a\nb\nc', { width: 200, height: 30 })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 200, 30));
  });
});

describe('layout flex — images in flow', () => {
  it('derives height from width via the aspect ratio', () => {
    const { slide } = layout([rImage({ src: 'a.png', width: 200 })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 200, 100));
  });

  it('derives width from height via the aspect ratio', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 100, align: 'start' }, [rImage({ src: 'a.png', height: 50 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 100, 50));
  });

  it('uses the natural size (px × 0.75) without dimensions, even under align=stretch', () => {
    const { slide } = layout([rImage({ src: 'a.png' }), rBox({ height: 10 })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 300, 150));
    expect(child(slide, 1).frame.y).toBeCloseTo(150);
  });

  it('uses the natural size inside an align="start" container', () => {
    const { slide } = layout([rBox({ align: 'start' }, [rImage({ src: 'a.png' })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 300, 150));
  });

  it('grows along the main axis with grow', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 100 }, [rBox({ width: 120 }), rImage({ src: 'a.png', grow: 1 })])]);
    const frame = child(slide, 0, 1).frame;
    expect(frame.x).toBeCloseTo(120);
    expect(frame.width).toBeCloseTo(600);
  });

  it('fills the remaining height with grow in a column', () => {
    const { slide } = layout([rBox({ height: 105 }), rImage({ src: 'a.png', grow: 1 })]);
    const frame = child(slide, 1).frame;
    expect(frame.y).toBeCloseTo(105);
    expect(frame.height).toBeCloseTo(300);
  });

  it('records the intrinsic size', () => {
    const { slide } = layout([rImage({ src: 'a.png', width: 10 })]);
    const node = child(slide, 0);
    expect(node.kind === 'image' && node.intrinsic).toEqual({ width: 400, height: 200 });
  });
});

describe('layout flex — shapes and decoration', () => {
  it('a shape without size is 0 on the main axis and stretches on the cross axis (column)', () => {
    const { slide } = layout([rShape({ kind: 'rect' })]);
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 0));
  });

  it('a shape without size is 0 wide and stretches to the row height (row)', () => {
    const { slide } = layout([rBox({ direction: 'row', height: 100 }, [rShape({ kind: 'rect' })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 0, 100));
  });

  it('a shape without size is 0×0 when the parent does not stretch', () => {
    const { slide } = layout([rBox({ align: 'start' }, [rShape({ kind: 'ellipse' })])]);
    expectFrame(child(slide, 0, 0).frame, rect(0, 0, 0, 0));
  });

  it('a sized shape takes its size in the flow', () => {
    const { slide } = layout([rBox({ height: 10 }), rShape({ kind: 'ellipse', width: 30, height: 40 })]);
    expectFrame(child(slide, 1).frame, rect(0, 10, 30, 40));
  });

  it('fill/stroke on a box does not change the layout', () => {
    const plain = layout([rBox({ padding: 5 }, [rBox({ height: 10 })])]).slide;
    const styled = layout([rBox({ padding: 5, fill: '#ff0000', stroke: '#000000', strokeWidth: 8 }, [rBox({ height: 10 })])]).slide;
    expect(child(styled, 0).frame).toEqual(child(plain, 0).frame);
    expect(child(styled, 0, 0).frame).toEqual(child(plain, 0, 0).frame);
  });
});

describe('layout flex — slide container', () => {
  it('centers content vertically with padding + justify="center"', () => {
    const { slide } = layout([rBox({ height: 100 })], { padding: 20, justify: 'center' });
    expectFrame(child(slide, 0).frame, rect(20, 152.5, 680, 100));
  });

  it('centers on both axes with justify + align center', () => {
    const { slide } = layout([sized(100, 50)], { justify: 'center', align: 'center' });
    expectFrame(child(slide, 0).frame, rect(310, 177.5, 100, 50));
  });

  it('keeps the slide frame equal to the slide size regardless of padding', () => {
    const { slide } = layout([], { padding: 30 });
    expectFrame(slide.frame, rect(0, 0, 720, 405));
  });
});

describe('layout flex — purity', () => {
  const sample = (): ResolvedSlide =>
    rSlide(
      [
        rBox({ direction: 'row', gap: 10, padding: { top: 5 } }, [rText('a\nb', { grow: 1 }), rImage({ src: 'x.png', width: 40 })]),
        rShape({ ...abs, kind: 'line', left: '10%', top: 0, width: 10, height: 10 }),
      ],
      { padding: 20, justify: 'center' },
    );

  it('does not mutate (deep-frozen input works and stays equal)', () => {
    const fake = createFakeEnv();
    const input = rDeck(sample());
    const snapshot = JSON.parse(JSON.stringify(input));
    deepFreeze(input);
    expect(() => layoutDeck(input, SIZE_16X9, fake.env)).not.toThrow();
    expect(input).toEqual(snapshot);
  });

  it('is deterministic: two calls give equal trees', () => {
    const a = layoutSlide(sample(), SIZE_16X9, createFakeEnv().env);
    const b = layoutSlide(sample(), SIZE_16X9, createFakeEnv().env);
    expect(a).toEqual(b);
  });

  it('keeps props and path of every node', () => {
    const input = sample();
    const out = layoutSlide(input, SIZE_16X9, createFakeEnv().env);
    expect(child(out, 0).props).toEqual(input.children[0]?.props);
    expect(child(out, 0, 0).path).toBe('Text');
  });
});
