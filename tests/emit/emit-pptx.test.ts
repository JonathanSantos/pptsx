import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { Resvg } from '@resvg/resvg-js';
import { emitPptx } from '../../src/emit/index.ts';
import type { PositionedDeck, PositionedNode, SlideSize } from '../../src/core/types.ts';
import {
  SIZE_16X9,
  SIZE_4X3,
  fakeTextLayout,
  pBox,
  pDeck,
  pImage,
  pShape,
  pSlide,
  pText,
  rect,
} from '../helpers/nodes.ts';

const EMU_PER_PT = 12700;

let baseDir = '';

beforeAll(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'tsx-slides-emit-'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#3366cc"/></svg>';
  writeFileSync(join(baseDir, 'pic.png'), new Resvg(svg).render().asPng());
});

afterAll(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

const open = async (deck: PositionedDeck, debug = false) => {
  const buffer = await emitPptx(deck, { baseDir, debug });
  const zip = await JSZip.loadAsync(buffer);
  const read = async (path: string): Promise<string> => {
    const file = zip.file(path);
    if (!file) throw new Error(`missing ${path} in pptx`);
    return file.async('string');
  };
  return { buffer, zip, read };
};

const oneSlide = (children: readonly PositionedNode[], props = {}, size: SlideSize = SIZE_16X9) =>
  pDeck([pSlide(children, props, size)], size);

const slideXml = async (children: readonly PositionedNode[], props = {}, debug = false) =>
  (await open(oneSlide(children, props), debug)).read('ppt/slides/slide1.xml');

const count = (xml: string, re: RegExp): number => (xml.match(new RegExp(re.source, 'g')) ?? []).length;
const shapeCount = (xml: string) => count(xml, /<p:sp>/);
const picCount = (xml: string) => count(xml, /<p:pic>/);
const emu = (pt: number) => Math.round(pt * EMU_PER_PT);

describe('emitPptx — package', () => {
  it('returns a Buffer', async () => {
    const { buffer } = await open(oneSlide([]));
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('writes one slide xml per slide', async () => {
    const { zip } = await open(pDeck([pSlide(), pSlide()]));
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide2.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide3.xml')).toBeNull();
  });

  it('sets sldSz in EMU for 16x9 (720×405 pt)', async () => {
    const xml = await (await open(oneSlide([]))).read('ppt/presentation.xml');
    expect(xml).toMatch(new RegExp(`<p:sldSz[^>]*cx="${emu(720)}"[^>]*cy="${emu(405)}"`));
    expect(emu(720)).toBe(9144000);
  });

  it('sets sldSz in EMU for 4x3 (720×540 pt)', async () => {
    const xml = await (await open(oneSlide([], {}, SIZE_4X3))).read('ppt/presentation.xml');
    expect(xml).toMatch(new RegExp(`<p:sldSz[^>]*cx="9144000"[^>]*cy="${emu(540)}"`));
  });

  it('sets sldSz in EMU for a custom size', async () => {
    const size = { name: 'custom-8x6', width: 576, height: 432 };
    const xml = await (await open(oneSlide([], {}, size))).read('ppt/presentation.xml');
    expect(xml).toMatch(new RegExp(`<p:sldSz[^>]*cx="${emu(576)}"[^>]*cy="${emu(432)}"`));
  });
});

describe('emitPptx — text', () => {
  it('emits the text content', async () => {
    const xml = await slideXml([pText(rect(10, 20, 200, 40), 'Hello world')]);
    expect(xml).toContain('<a:t>Hello world</a:t>');
  });

  it('places the text box at the frame in EMU', async () => {
    const xml = await slideXml([pText(rect(10, 20, 200, 40), 'Hello')]);
    expect(xml).toContain(`<a:off x="${emu(10)}" y="${emu(20)}"/>`);
    expect(xml).toContain(`<a:ext cx="${emu(200)}" cy="${emu(40)}"/>`);
  });

  it('uses zero insets', async () => {
    const xml = await slideXml([pText(rect(0, 0, 100, 20), 'x')]);
    const bodyPr = xml.match(/<a:bodyPr[^>]*>/)?.[0] ?? '';
    expect(bodyPr).toContain('lIns="0"');
    expect(bodyPr).toContain('tIns="0"');
    expect(bodyPr).toContain('rIns="0"');
    expect(bodyPr).toContain('bIns="0"');
  });

  it('anchors text at the top', async () => {
    const xml = await slideXml([pText(rect(0, 0, 100, 20), 'x')]);
    expect(xml.match(/<a:bodyPr[^>]*>/)?.[0]).toContain('anchor="t"');
  });

  it('has no autofit', async () => {
    const xml = await slideXml([pText(rect(0, 0, 100, 20), 'x')]);
    expect(xml).not.toContain('normAutofit');
    expect(xml).not.toContain('spAutoFit');
  });

  it('emits font size, face, bold and italic', async () => {
    const xml = await slideXml([
      pText(rect(0, 0, 100, 20), 'x', { size: 24, font: 'Arial', weight: 'bold', italic: true }),
    ]);
    const rPr = xml.match(/<a:rPr[^>]*>/)?.[0] ?? '';
    expect(rPr).toContain('sz="2400"');
    expect(rPr).toContain('b="1"');
    expect(rPr).toContain('i="1"');
    expect(xml).toContain('<a:latin typeface="Arial"');
  });

  it('uses the fontSize from the TextLayout (possibly shrunk by fit)', async () => {
    const xml = await slideXml([pText(rect(0, 0, 100, 20), 'x', { size: 24 }, fakeTextLayout('x', 20))]);
    expect(xml.match(/<a:rPr[^>]*>/)?.[0]).toContain('sz="2000"');
  });

  it('emits the color without #', async () => {
    const xml = await slideXml([pText(rect(0, 0, 100, 20), 'x', { color: '#ff0000' })]);
    expect(xml).toMatch(/<a:srgbClr val="ff0000"\/>/i);
    expect(xml).not.toContain('val="#');
  });

  it('emits the alignment', async () => {
    const xml = await slideXml([pText(rect(0, 0, 100, 20), 'x', { align: 'center' })]);
    expect(xml).toContain('algn="ctr"');
  });

  it('emits truncated lines joined by line breaks instead of the original content', async () => {
    const text = { ...fakeTextLayout('aaa\nbb…'), truncated: true };
    const xml = await slideXml([pText(rect(0, 0, 100, 40), 'aaa bbbbbb cccccc', {}, text)]);
    expect(xml).toContain('aaa');
    expect(xml).toContain('bb…');
    expect(xml).not.toContain('cccccc');
  });
});

describe('emitPptx — shapes and boxes', () => {
  it.each([
    ['ellipse', 'ellipse'],
    ['rect', 'rect'],
    ['line', 'line'],
  ] as const)('Shape kind %s emits prstGeom %s', async (kind, prst) => {
    const xml = await slideXml([pShape(rect(10, 10, 100, 50), { kind, stroke: '#000000' })]);
    expect(xml).toContain(`<a:prstGeom prst="${prst}">`);
  });

  it('Shape kind roundRect emits prstGeom roundRect', async () => {
    const xml = await slideXml([pShape(rect(10, 10, 100, 50), { kind: 'roundRect', radius: 8, fill: '#00ff00' })]);
    expect(xml).toContain('<a:prstGeom prst="roundRect">');
  });

  it('places shapes at the frame in EMU', async () => {
    const xml = await slideXml([pShape(rect(36, 72, 144, 18), { kind: 'rect', fill: '#00ff00' })]);
    expect(xml).toContain(`<a:off x="${emu(36)}" y="${emu(72)}"/>`);
    expect(xml).toContain(`<a:ext cx="${emu(144)}" cy="${emu(18)}"/>`);
  });

  it('emits fill color without #', async () => {
    const xml = await slideXml([pShape(rect(0, 0, 10, 10), { kind: 'rect', fill: '#00ff00' })]);
    expect(xml).toMatch(/<a:solidFill><a:srgbClr val="00ff00"\/><\/a:solidFill>/i);
    expect(xml).not.toContain('val="#');
  });

  it('emits stroke color and width (pt → EMU)', async () => {
    const xml = await slideXml([pShape(rect(0, 0, 10, 10), { kind: 'rect', stroke: '#0000ff', strokeWidth: 2 })]);
    expect(xml).toMatch(new RegExp(`<a:ln w="${emu(2)}"><a:solidFill><a:srgbClr val="0000ff"/>`, 'i'));
  });

  it('Box with fill becomes a rect shape', async () => {
    const xml = await slideXml([pBox(rect(0, 0, 100, 100), { fill: '#123456' })]);
    expect(shapeCount(xml)).toBe(1);
    expect(xml).toContain('<a:prstGeom prst="rect">');
    expect(xml).toMatch(/val="123456"/i);
  });

  it('Box with only stroke becomes a shape', async () => {
    const xml = await slideXml([pBox(rect(0, 0, 100, 100), { stroke: '#123456' })]);
    expect(shapeCount(xml)).toBe(1);
  });

  it('Box with radius > 0 and fill becomes a roundRect', async () => {
    const xml = await slideXml([pBox(rect(0, 0, 100, 100), { fill: '#123456', radius: 10 })]);
    expect(xml).toContain('<a:prstGeom prst="roundRect">');
  });

  it('Box without fill or stroke emits no shape', async () => {
    const empty = await slideXml([]);
    const withBox = await slideXml([pBox(rect(0, 0, 100, 100))]);
    expect(shapeCount(withBox)).toBe(shapeCount(empty));
  });

  it('still emits the children of a Box without fill or stroke', async () => {
    const xml = await slideXml([pBox(rect(0, 0, 300, 100), {}, [pText(rect(10, 10, 100, 20), 'child text')])]);
    expect(shapeCount(xml)).toBe(1);
    expect(xml).toContain('<a:t>child text</a:t>');
  });

  it('emits a Box before its children (z-order)', async () => {
    const xml = await slideXml([
      pBox(rect(0, 0, 300, 100), { fill: '#abcdef' }, [pText(rect(10, 10, 100, 20), 'on top')]),
    ]);
    expect(xml.search(/abcdef/i)).toBeLessThan(xml.indexOf('on top'));
  });
});

describe('emitPptx — images', () => {
  it('embeds an image resolved against baseDir', async () => {
    const { zip, read } = await open(oneSlide([pImage(rect(10, 10, 80, 40), { src: 'pic.png' }, { width: 40, height: 20 })]));
    const xml = await read('ppt/slides/slide1.xml');
    expect(picCount(xml)).toBe(1);
    expect(Object.keys(zip.files).some((f) => f.startsWith('ppt/media/') && !f.endsWith('/'))).toBe(true);
  });

  it('accepts an absolute image path', async () => {
    const { read } = await open(
      oneSlide([pImage(rect(0, 0, 80, 40), { src: join(baseDir, 'pic.png') }, { width: 40, height: 20 })]),
    );
    expect(picCount(await read('ppt/slides/slide1.xml'))).toBe(1);
  });
});

describe('emitPptx — slide background and notes', () => {
  it('emits a color background without #', async () => {
    const xml = await slideXml([], { background: '#112233' });
    expect(xml).toMatch(/<p:bg>.*<a:srgbClr val="112233"\/>.*<\/p:bg>/i);
  });

  it('emits an image background', async () => {
    const { zip, read } = await open(oneSlide([], { background: { image: 'pic.png' } }));
    const xml = await read('ppt/slides/slide1.xml');
    expect(xml).toContain('<p:bg>');
    expect(Object.keys(zip.files).some((f) => f.startsWith('ppt/media/') && !f.endsWith('/'))).toBe(true);
  });

  it('emits speaker notes', async () => {
    const { zip } = await open(oneSlide([], { notes: 'Remember the demo' }));
    const notesFiles = Object.keys(zip.files).filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    const contents = await Promise.all(notesFiles.map((f) => zip.file(f)!.async('string')));
    expect(contents.some((c) => c.includes('Remember the demo'))).toBe(true);
  });
});

describe('emitPptx — debug', () => {
  const children = [
    pBox(rect(0, 0, 300, 200), { fill: '#eeeeee' }, [pText(rect(10, 10, 100, 20), 'x')]),
    pImage(rect(400, 10, 80, 40), { src: 'pic.png' }, { width: 40, height: 20 }),
  ];

  it('adds one extra outline per Box/Text/Image frame', async () => {
    const normal = await slideXml(children);
    const debug = await slideXml(children, {}, true);
    expect(shapeCount(debug)).toBe(shapeCount(normal) + 3);
  });

  it('draws outlines in red, without fill, dashed', async () => {
    const debug = await slideXml([pBox(rect(0, 0, 100, 100))], {}, true);
    expect(debug).toMatch(/srgbClr val="ff0000"/i);
    expect(debug).toContain('<a:noFill/>');
    expect(debug).toContain(`<a:ln w="${emu(0.5)}">`);
    expect(debug).toMatch(/<a:prstDash val="(?!solid)[a-zA-Z]+"\/>/);
  });

  it('emits no outlines when debug is false', async () => {
    const normal = await slideXml([pBox(rect(0, 0, 100, 100))]);
    expect(shapeCount(normal)).toBe(0);
  });
});
