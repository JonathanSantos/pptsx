import { describe, expect, it } from 'vitest';
import { buildOverview, type OverviewItem } from '../../src/preview/index.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import { isPng, makePng, pngSize } from '../helpers/png.ts';

const THUMB = DEFAULTS.preview.thumbWidth;
const COLUMNS = DEFAULTS.preview.overviewColumns;
const SLIDE_PNG = makePng(640, 360);

const items = (n: number, badge?: OverviewItem['badge']): OverviewItem[] =>
  Array.from({ length: n }, (_, i) => ({ png: SLIDE_PNG, number: i + 1, ...(badge ? { badge } : {}) }));

const sizeOf = (n: number, options?: Parameters<typeof buildOverview>[1]) => pngSize(buildOverview(items(n), options));

describe('buildOverview', () => {
  it('returns a valid PNG', () => {
    expect(isPng(buildOverview(items(3)))).toBe(true);
  });

  it('is at least columns × thumbWidth wide for 4+ items', () => {
    expect(sizeOf(4).width).toBeGreaterThanOrEqual(COLUMNS * THUMB);
    expect(sizeOf(9).width).toBeGreaterThanOrEqual(COLUMNS * THUMB);
  });

  it('keeps the same width once the first row is full', () => {
    expect(sizeOf(8).width).toBe(sizeOf(4).width);
  });

  it('grows in height with the number of rows (ceil(N/4))', () => {
    const one = sizeOf(4).height;
    const two = sizeOf(5).height;
    const three = sizeOf(9).height;
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    // linhas iguais → mesma altura
    expect(sizeOf(8).height).toBe(two);
    expect(sizeOf(1).height).toBe(one);
  });

  it('adds rows in roughly constant steps', () => {
    const h1 = sizeOf(4).height;
    const h2 = sizeOf(8).height;
    const h3 = sizeOf(12).height;
    expect(h3 - h2).toBe(h2 - h1);
    // cada linha cabe ao menos uma miniatura 16:9
    expect(h2 - h1).toBeGreaterThanOrEqual(Math.floor((THUMB * 9) / 16));
  });

  it('respects the columns option', () => {
    const two = sizeOf(4, { columns: 2 });
    expect(two.width).toBeGreaterThanOrEqual(2 * THUMB);
    expect(two.width).toBeLessThan(sizeOf(4).width);
    expect(two.height).toBeGreaterThan(sizeOf(4).height);
  });

  it('respects the thumbWidth option', () => {
    const small = sizeOf(4, { thumbWidth: 160 });
    expect(small.width).toBeGreaterThanOrEqual(4 * 160);
    expect(small.width).toBeLessThan(sizeOf(4).width);
  });

  it('does not break with error/warning badges and keeps the same size', () => {
    const plain = sizeOf(5);
    const withBadges = buildOverview([
      ...items(2, 'error'),
      ...items(2, 'warning'),
      { png: SLIDE_PNG, number: 5 },
    ]);
    expect(isPng(withBadges)).toBe(true);
    expect(pngSize(withBadges)).toEqual(plain);
  });

  it('accepts thumbnails with other aspect ratios', () => {
    const png = buildOverview([{ png: makePng(400, 300), number: 1 }, { png: SLIDE_PNG, number: 2 }]);
    expect(isPng(png)).toBe(true);
  });
});
