import { describe, expect, it } from 'vitest';
import { slideToSvg, svgToPng } from '../../src/preview/index.ts';
import { SIZE_16X9, SIZE_4X3, pBox, pSlide, pText, rect } from '../helpers/nodes.ts';
import { FONT_REGULAR, isPng, pngSize } from '../helpers/png.ts';

const svgFor = (size = SIZE_16X9) =>
  slideToSvg(
    pSlide([pBox(rect(10, 10, 100, 50), { fill: '#3366cc' }), pText(rect(10, 80, 300, 20), 'Hello & <world>')], { background: '#ffffff' }, size),
    size,
    { widthPx: 1280, baseDir: '/', fontFamilyMap: { Arial: 'Liberation Sans' } },
  );

describe('svgToPng', () => {
  it('returns a PNG buffer (signature + IHDR)', () => {
    const png = svgToPng(svgFor(), { widthPx: 640, fontFiles: [FONT_REGULAR] });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(isPng(png)).toBe(true);
  });

  it('rasterizes at widthPx and keeps the slide aspect (16x9)', () => {
    const { width, height } = pngSize(svgToPng(svgFor(), { widthPx: 640, fontFiles: [FONT_REGULAR] }));
    expect(width).toBe(640);
    expect(height).toBe(360);
  });

  it('keeps the slide aspect for 4x3', () => {
    const { width, height } = pngSize(svgToPng(svgFor(SIZE_4X3), { widthPx: 800, fontFiles: [FONT_REGULAR] }));
    expect(width).toBe(800);
    expect(height).toBe(600);
  });

  it('honours widthPx even when it differs from the SVG width attribute', () => {
    const { width } = pngSize(svgToPng(svgFor(), { widthPx: 320, fontFiles: [FONT_REGULAR] }));
    expect(width).toBe(320);
  });

  it('works without font files', () => {
    expect(isPng(svgToPng(svgFor(), { widthPx: 100, fontFiles: [] }))).toBe(true);
  });
});
