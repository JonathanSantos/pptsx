import { describe, expect, it } from 'vitest';
import { slideToSvg, type SvgOptions } from '../../src/preview/index.ts';
import type { PositionedNode, PositionedSlide, TextLayout } from '../../src/core/types.ts';
import { SIZE_16X9, SIZE_4X3, pBox, pImage, pShape, pSlide, pText, rect, singleRunLines, type TestSlideProps } from '../helpers/nodes.ts';
import { makePng } from '../helpers/png.ts';
import { findElements, isDashed, isRed, num, rootSvg, styleOf, textOf } from '../helpers/svg.ts';

const PNG = makePng(4, 2);

const readCalls: string[] = [];
const options = (over: Partial<SvgOptions> = {}): SvgOptions => ({
  widthPx: 1280,
  baseDir: '/base',
  readFile: (path) => {
    readCalls.push(path);
    return PNG;
  },
  ...over,
});

const svgOf = (children: readonly PositionedNode[], props: TestSlideProps = {}, over: Partial<SvgOptions> = {}) =>
  slideToSvg(pSlide(children, props), SIZE_16X9, options(over));

const textLayout = (lines: readonly string[], over: Partial<TextLayout> = {}): TextLayout => ({
  lines,
  paragraphs: [lines],
  lineRuns: singleRunLines(lines),
  fontSize: 18,
  lineHeight: 24,
  ascent: 17,
  width: 100,
  height: lines.length * 24,
  widestSegment: 0,
  truncated: false,
  fontMissing: false,
  wordBroken: false,
  ...over,
});

/** Retângulos com preenchimento visível (ignora fill="none"). */
const filledRects = (svg: string) => findElements(svg, 'rect').filter((r) => {
  const fill = styleOf(r, 'fill');
  return fill !== undefined && fill !== 'none';
});

describe('slideToSvg — root', () => {
  it('uses a viewBox in pt "0 0 W H"', () => {
    expect(rootSvg(svgOf([])).attrs.viewBox?.trim().split(/[\s,]+/).map(Number)).toEqual([0, 0, 720, 405]);
  });

  it('uses widthPx as the width attribute', () => {
    expect(num(rootSvg(svgOf([], {}, { widthPx: 640 })).attrs.width)).toBe(640);
  });

  it('follows the slide size (4x3)', () => {
    const svg = slideToSvg(pSlide([], {}, SIZE_4X3), SIZE_4X3, options());
    expect(rootSvg(svg).attrs.viewBox?.trim().split(/[\s,]+/).map(Number)).toEqual([0, 0, 720, 540]);
  });

  it('declares the SVG namespace', () => {
    expect(rootSvg(svgOf([])).attrs.xmlns).toBe('http://www.w3.org/2000/svg');
  });
});

describe('slideToSvg — text', () => {
  const textNode = (align?: 'left' | 'center' | 'right') =>
    pText(rect(50, 100, 300, 72), 'one two three', align ? { align } : {}, textLayout(['one', 'two', 'three']));

  it('emits one <text> per line of PositionedText.text.lines', () => {
    const texts = findElements(svgOf([textNode()]), 'text');
    expect(texts.map(textOf)).toEqual(['one', 'two', 'three']);
  });

  it('places each line at y = frame.y + i × lineHeight + ascent', () => {
    const texts = findElements(svgOf([textNode()]), 'text');
    texts.forEach((t, i) => expect(num(t.attrs.y)).toBeCloseTo(100 + i * 24 + 17));
  });

  it('align left (default): x = frame.x and text-anchor start (or absent)', () => {
    const [t] = findElements(svgOf([textNode()]), 'text');
    expect(num(t?.attrs.x)).toBeCloseTo(50);
    expect(styleOf(t!, 'text-anchor') ?? 'start').toBe('start');
  });

  it('align center: x = frame center and text-anchor middle', () => {
    const [t] = findElements(svgOf([textNode('center')]), 'text');
    expect(num(t?.attrs.x)).toBeCloseTo(200);
    expect(styleOf(t!, 'text-anchor')).toBe('middle');
  });

  it('align right: x = frame right edge and text-anchor end', () => {
    const [t] = findElements(svgOf([textNode('right')]), 'text');
    expect(num(t?.attrs.x)).toBeCloseTo(350);
    expect(styleOf(t!, 'text-anchor')).toBe('end');
  });

  it('uses the (possibly fitted) font size from the text layout', () => {
    const node = pText(rect(0, 0, 100, 20), 'a', { size: 30 }, textLayout(['a'], { fontSize: 22 }));
    const [t] = findElements(svgOf([node]), 'text');
    expect(Number.parseFloat(styleOf(t!, 'font-size') ?? '')).toBeCloseTo(22);
  });

  it('applies color, bold and italic', () => {
    const node = pText(rect(0, 0, 100, 20), 'a', { color: '#123456', weight: 'bold', italic: true }, textLayout(['a']));
    const [t] = findElements(svgOf([node]), 'text');
    expect(styleOf(t!, 'fill')?.toLowerCase()).toBe('#123456');
    expect(styleOf(t!, 'font-weight')).toMatch(/bold|700/);
    expect(styleOf(t!, 'font-style')).toBe('italic');
  });

  it('uses the node family as font-family', () => {
    const node = pText(rect(0, 0, 100, 20), 'a', { font: 'Inter' }, textLayout(['a']));
    const [t] = findElements(svgOf([node]), 'text');
    expect(styleOf(t!, 'font-family')).toContain('Inter');
  });

  it('defaults font-family to Arial', () => {
    const [t] = findElements(svgOf([pText(rect(0, 0, 100, 20), 'a', {}, textLayout(['a']))]), 'text');
    expect(styleOf(t!, 'font-family')).toContain('Arial');
  });

  it('maps the family through fontFamilyMap', () => {
    const node = pText(rect(0, 0, 100, 20), 'a', { font: 'Arial' }, textLayout(['a']));
    const svg = svgOf([node], {}, { fontFamilyMap: { Arial: 'Liberation Sans' } });
    const [t] = findElements(svg, 'text');
    expect(styleOf(t!, 'font-family')).toContain('Liberation Sans');
    expect(styleOf(t!, 'font-family')).not.toContain('Arial');
  });

  it('escapes &, < and > in text', () => {
    const node = pText(rect(0, 0, 100, 20), 'a & b < c > d', {}, textLayout(['a & b < c > d']));
    const [t] = findElements(svgOf([node]), 'text');
    expect(t?.inner).toContain('&amp;');
    expect(t?.inner).toContain('&lt;');
    expect(t?.inner).toContain('&gt;');
    expect(t?.inner).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/);
  });

  it('never wraps on its own: the full line goes in a single <text>', () => {
    const long = 'a very long line that would never fit in such a narrow frame';
    const node = pText(rect(0, 0, 10, 20), long, {}, textLayout([long]));
    expect(findElements(svgOf([node]), 'text').map(textOf)).toEqual([long]);
  });

  it('an empty line produces no visible glyphs but keeps the next line position', () => {
    const node = pText(rect(0, 0, 100, 72), 'a\n\nb', {}, textLayout(['a', '', 'b']));
    const texts = findElements(svgOf([node]), 'text').filter((t) => textOf(t) !== '');
    const b = texts.find((t) => textOf(t) === 'b');
    expect(num(b?.attrs.y)).toBeCloseTo(2 * 24 + 17);
  });
});

describe('slideToSvg — boxes and shapes', () => {
  it('a box without fill/stroke adds no <rect>', () => {
    const base = findElements(svgOf([]), 'rect').length;
    expect(findElements(svgOf([pBox(rect(10, 10, 100, 50))]), 'rect')).toHaveLength(base);
  });

  it('a box with fill becomes a <rect> at its frame', () => {
    const [r] = findElements(svgOf([pBox(rect(10, 20, 100, 50), { fill: '#ff8800' })]), 'rect').filter(
      (e) => styleOf(e, 'fill')?.toLowerCase() === '#ff8800',
    );
    expect(r).toBeDefined();
    expect([num(r?.attrs.x), num(r?.attrs.y), num(r?.attrs.width), num(r?.attrs.height)]).toEqual([10, 20, 100, 50]);
  });

  it('a box with only stroke becomes a <rect> with the stroke and default width 1', () => {
    const rects = findElements(svgOf([pBox(rect(10, 20, 100, 50), { stroke: '#00ff00' })]), 'rect').filter(
      (e) => styleOf(e, 'stroke')?.toLowerCase() === '#00ff00',
    );
    expect(rects).toHaveLength(1);
    expect(num(styleOf(rects[0]!, 'stroke-width'))).toBeCloseTo(1);
  });

  it('a box with radius gets rx', () => {
    const [r] = findElements(svgOf([pBox(rect(0, 0, 100, 50), { fill: '#ff8800', radius: 8 })]), 'rect').filter(
      (e) => styleOf(e, 'fill')?.toLowerCase() === '#ff8800',
    );
    expect(num(r?.attrs.rx)).toBeCloseTo(8);
  });

  it('a rect shape becomes a <rect>', () => {
    const rects = filledRects(svgOf([pShape(rect(1, 2, 3, 4), { kind: 'rect', fill: '#abcdef' })])).filter(
      (e) => styleOf(e, 'fill')?.toLowerCase() === '#abcdef',
    );
    expect(rects).toHaveLength(1);
  });

  it('a roundRect shape becomes a <rect> with rx', () => {
    const [r] = findElements(svgOf([pShape(rect(0, 0, 50, 50), { kind: 'roundRect', radius: 6, fill: '#abcdef' })]), 'rect').filter(
      (e) => styleOf(e, 'fill')?.toLowerCase() === '#abcdef',
    );
    expect(num(r?.attrs.rx)).toBeCloseTo(6);
  });

  it('an ellipse shape becomes an <ellipse> inscribed in the frame', () => {
    const [e] = findElements(svgOf([pShape(rect(10, 20, 100, 40), { kind: 'ellipse', fill: '#abcdef' })]), 'ellipse');
    expect(e).toBeDefined();
    expect([num(e?.attrs.cx), num(e?.attrs.cy), num(e?.attrs.rx), num(e?.attrs.ry)]).toEqual([60, 40, 50, 20]);
  });

  it('a line goes from the top-left to the bottom-right corner of the frame', () => {
    const [l] = findElements(svgOf([pShape(rect(10, 20, 100, 40), { kind: 'line' })]), 'line');
    expect([num(l?.attrs.x1), num(l?.attrs.y1), num(l?.attrs.x2), num(l?.attrs.y2)]).toEqual([10, 20, 110, 60]);
  });

  it('a line without stroke is drawn in black', () => {
    const [l] = findElements(svgOf([pShape(rect(0, 0, 10, 10), { kind: 'line' })]), 'line');
    expect(styleOf(l!, 'stroke')?.toLowerCase()).toMatch(/^(#000000|#000|black)$/);
  });

  it('a shape with stroke carries stroke color and width', () => {
    const [e] = findElements(
      svgOf([pShape(rect(0, 0, 10, 10), { kind: 'ellipse', stroke: '#112233', strokeWidth: 3 })]),
      'ellipse',
    );
    expect(styleOf(e!, 'stroke')?.toLowerCase()).toBe('#112233');
    expect(num(styleOf(e!, 'stroke-width'))).toBeCloseTo(3);
  });

  it('a shape without fill is not filled', () => {
    const [e] = findElements(svgOf([pShape(rect(0, 0, 10, 10), { kind: 'ellipse', stroke: '#112233' })]), 'ellipse');
    expect(styleOf(e!, 'fill') ?? 'none').toBe('none');
  });
});

describe('slideToSvg — images', () => {
  const imageSvg = (fit?: 'contain' | 'cover') =>
    svgOf([pImage(rect(10, 20, 200, 100), fit ? { src: 'pics/a.png', fit } : { src: 'pics/a.png' }, { width: 4, height: 2 })]);

  const imageHref = (svg: string) => {
    const imgs = findElements(svg, 'image');
    return imgs.map((i) => i.attrs.href ?? '');
  };

  it('embeds the file as <image href="data:image/png;base64,...">', () => {
    const [href] = imageHref(imageSvg());
    expect(href).toBe(`data:image/png;base64,${PNG.toString('base64')}`);
  });

  it('reads the image through the injected readFile, resolved against baseDir', () => {
    readCalls.length = 0;
    imageSvg();
    expect(readCalls).toContain('/base/pics/a.png');
  });

  it('places the image at its frame', () => {
    const [img] = findElements(imageSvg(), 'image');
    expect([num(img?.attrs.x), num(img?.attrs.y), num(img?.attrs.width), num(img?.attrs.height)]).toEqual([10, 20, 200, 100]);
  });

  it('contain (default) → preserveAspectRatio "xMidYMid meet"', () => {
    const [img] = findElements(imageSvg(), 'image');
    expect(img?.attrs.preserveAspectRatio).toBe('xMidYMid meet');
  });

  it('cover → preserveAspectRatio "xMidYMid slice" with a clipPath', () => {
    const svg = imageSvg('cover');
    const [img] = findElements(svg, 'image');
    expect(img?.attrs.preserveAspectRatio).toBe('xMidYMid slice');
    expect(findElements(svg, 'clipPath').length).toBeGreaterThan(0);
  });
});

describe('slideToSvg — background', () => {
  it('a color background becomes a full-slide <rect> drawn first', () => {
    const svg = svgOf([pBox(rect(0, 0, 10, 10), { fill: '#999999' })], { background: '#112233' });
    const rects = filledRects(svg);
    const bg = rects.find((r) => styleOf(r, 'fill')?.toLowerCase() === '#112233');
    expect(bg).toBeDefined();
    expect([num(bg?.attrs.width), num(bg?.attrs.height)]).toEqual([720, 405]);
    expect(Number.parseFloat(bg?.attrs.x ?? '0')).toBe(0);
    expect(Number.parseFloat(bg?.attrs.y ?? '0')).toBe(0);
    const box = rects.find((r) => styleOf(r, 'fill')?.toLowerCase() === '#999999');
    expect(bg!.index).toBeLessThan(box!.index);
  });

  it('an image background becomes a full-slide <image>', () => {
    readCalls.length = 0;
    const svg = svgOf([], { background: { image: 'bg.png' } });
    const [img] = findElements(svg, 'image');
    expect(img?.attrs.href).toMatch(/^data:image\/png;base64,/);
    expect([num(img?.attrs.width), num(img?.attrs.height)]).toEqual([720, 405]);
    expect(readCalls).toContain('/base/bg.png');
  });
});

describe('slideToSvg — draw order', () => {
  it('draws in tree order (pre-order: parent before children, siblings in order)', () => {
    const slide: PositionedSlide = pSlide([
      pBox(rect(0, 0, 100, 100), { fill: '#000001' }, [pShape(rect(0, 0, 10, 10), { kind: 'rect', fill: '#000002' })]),
      pShape(rect(0, 0, 10, 10), { kind: 'ellipse', fill: '#000003' }),
      pText(rect(0, 0, 10, 10), 'zzz', {}, textLayout(['zzz'])),
    ]);
    const svg = slideToSvg(slide, SIZE_16X9, options());
    const order = ['#000001', '#000002', '#000003'].map((c) => svg.toLowerCase().indexOf(c));
    order.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(svg.indexOf('zzz')).toBeGreaterThan(order[2]!);
  });
});

describe('slideToSvg — debug', () => {
  const tree = () => [
    pBox(rect(0, 0, 100, 100), {}, [pText(rect(5, 5, 50, 24), 'x', {}, textLayout(['x']))]),
    pImage(rect(200, 0, 50, 50), { src: 'a.png' }),
    pShape(rect(300, 0, 50, 50), { kind: 'ellipse', fill: '#abcdef' }),
  ];

  const dashedRed = (svg: string) =>
    ['rect', 'path', 'polygon'].flatMap((tag) => findElements(svg, tag)).filter((e) => isDashed(e) && isRed(styleOf(e, 'stroke')));

  it('without debug there are no red dashed outlines', () => {
    expect(dashedRed(svgOf(tree()))).toHaveLength(0);
  });

  it('with debug adds a red dashed outline for each Box/Text/Image frame', () => {
    const outlines = dashedRed(svgOf(tree(), {}, { debug: true }));
    expect(outlines.length).toBeGreaterThanOrEqual(3);
    const frames = outlines.filter((o) => o.tag === 'rect').map((o) => [num(o.attrs.x), num(o.attrs.y), num(o.attrs.width), num(o.attrs.height)]);
    expect(frames).toEqual(expect.arrayContaining([[0, 0, 100, 100], [5, 5, 50, 24], [200, 0, 50, 50]]));
  });

  it('debug outlines are not filled', () => {
    dashedRed(svgOf(tree(), {}, { debug: true })).forEach((o) => {
      const fill = styleOf(o, 'fill');
      expect(fill === 'none' || styleOf(o, 'fill-opacity') !== undefined || fill?.startsWith('rgba')).toBe(true);
    });
  });
});
