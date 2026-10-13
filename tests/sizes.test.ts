import { describe, expect, it } from 'vitest';
import { PRESETS, createContext, inchesToPt, parseSizeList, ptToInches, resolveSize } from '../src/sizes.ts';
import type { SizePresetName, SizeSpec } from '../src/core/types.ts';

describe('PRESETS', () => {
  it.each([
    ['16x9', 720, 405],
    ['16x10', 720, 450],
    ['4x3', 720, 540],
    ['wide', 960, 540],
  ] as const)('%s is %d × %d pt', (name, width, height) => {
    expect(PRESETS[name]).toEqual({ name, width, height });
  });

  it('has exactly the four documented presets', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(['16x10', '16x9', '4x3', 'wide']);
  });
});

describe('inchesToPt / ptToInches', () => {
  it('converts 1 inch to 72 pt', () => {
    expect(inchesToPt(1)).toBe(72);
  });

  it('converts 720 pt to 10 inches', () => {
    expect(ptToInches(720)).toBe(10);
  });

  it.each([0, 1, 5.625, 7.5, 13.333, 0.1])('round-trips %d inches', (inches) => {
    expect(ptToInches(inchesToPt(inches))).toBeCloseTo(inches, 10);
  });

  it.each([0, 1, 18, 405, 123.45])('round-trips %d pt', (pt) => {
    expect(inchesToPt(ptToInches(pt))).toBeCloseTo(pt, 10);
  });
});

describe('resolveSize', () => {
  it.each(['16x9', '16x10', '4x3', 'wide'] as const)('resolves preset %s to its PRESETS entry', (name) => {
    expect(resolveSize(name)).toEqual(PRESETS[name]);
  });

  it('resolves a custom size in inches to pt with a custom name', () => {
    expect(resolveSize({ width: 10, height: 7.5 })).toEqual({ name: 'custom-10x7.5', width: 720, height: 540 });
  });

  it('names integer custom sizes without decimals', () => {
    expect(resolveSize({ width: 8, height: 6 })).toEqual({ name: 'custom-8x6', width: 576, height: 432 });
  });

  it('throws on an unknown preset, listing the valid ones', () => {
    expect(() => resolveSize('5x5' as SizePresetName)).toThrow(Error);
    expect(() => resolveSize('5x5' as SizePresetName)).toThrow(/16x9/);
    expect(() => resolveSize('5x5' as SizePresetName)).toThrow(/wide/);
  });
});

describe('createContext', () => {
  it('copies name and dimensions from the size', () => {
    const ctx = createContext(PRESETS['16x9']);
    expect(ctx).toMatchObject({ name: '16x9', width: 720, height: 405 });
  });

  it('16x9: aspect 16/9 and scale 1', () => {
    const ctx = createContext(PRESETS['16x9']);
    expect(ctx.aspect).toBeCloseTo(16 / 9, 10);
    expect(ctx.scale).toBe(1);
  });

  it('4x3: aspect 4/3 and scale min(1, 540/405) = 1', () => {
    const ctx = createContext(PRESETS['4x3']);
    expect(ctx.aspect).toBeCloseTo(4 / 3, 10);
    expect(ctx.scale).toBe(1);
  });

  it('16x10: aspect 1.6 and scale 1', () => {
    const ctx = createContext(PRESETS['16x10']);
    expect(ctx.aspect).toBeCloseTo(1.6, 10);
    expect(ctx.scale).toBe(1);
  });

  it('wide: scale min(960/720, 540/405) = 4/3', () => {
    const ctx = createContext(PRESETS.wide);
    expect(ctx.aspect).toBeCloseTo(960 / 540, 10);
    expect(ctx.scale).toBeCloseTo(4 / 3, 10);
  });

  it('custom smaller size scales below 1', () => {
    const ctx = createContext(resolveSize({ width: 5, height: 2.8125 }));
    expect(ctx.scale).toBeCloseTo(0.5, 10);
  });
});

describe('parseSizeList', () => {
  it("parses '16x9,4x3' into presets", () => {
    expect(parseSizeList('16x9,4x3')).toEqual(['16x9', '4x3']);
  });

  it('parses a single preset', () => {
    expect(parseSizeList('wide')).toEqual(['wide']);
  });

  it("parses '10x7.5in' as a custom size in inches", () => {
    expect(parseSizeList('10x7.5in')).toEqual([{ width: 10, height: 7.5 }]);
  });

  it('mixes presets and custom sizes', () => {
    expect(parseSizeList('16x9,10x7.5in')).toEqual(['16x9', { width: 10, height: 7.5 }]);
  });

  it('a custom spec resolves to the custom name', () => {
    const [spec] = parseSizeList('10x7.5in') as [SizeSpec];
    expect(resolveSize(spec).name).toBe('custom-10x7.5');
  });

  it('rejects an unknown preset (at parse or resolve time) listing valid presets', () => {
    expect(() => parseSizeList('bogus').map(resolveSize)).toThrow(/16x9/);
  });
});
