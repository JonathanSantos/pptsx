import { describe, expect, it } from 'vitest';
import { parseGridPlacement } from '../../src/resolve/values.ts';
import { areaRect, parseTrackList, placeItems, sizeTracks, type SizingItem } from '../../src/layout/index.ts';
import type { GridPlacement } from '../../src/core/types.ts';

/** M11 (de poc/css/tests/grid.test.ts) — grid puro: sintaxe de tracks, placement e track sizing (casos calculados à mão). */

const AUTO: GridPlacement = { start: { kind: 'auto' }, end: { kind: 'auto' } };
const at = (value: string | number): GridPlacement => parseGridPlacement(value)!;

describe('parseTrackList', () => {
  it('parses repeat, minmax, fr, %, px and auto', () => {
    expect(parseTrackList('repeat(2, 1fr) 100px minmax(0, 2fr) 25% auto')).toEqual([
      { min: { kind: 'auto' }, max: { kind: 'fr', value: 1 } },
      { min: { kind: 'auto' }, max: { kind: 'fr', value: 1 } },
      { min: { kind: 'fixed', value: 100 }, max: { kind: 'fixed', value: 100 } },
      { min: { kind: 'fixed', value: 0 }, max: { kind: 'fr', value: 2 } },
      { min: { kind: 'percent', value: 25 }, max: { kind: 'percent', value: 25 } },
      { min: { kind: 'auto' }, max: { kind: 'auto' } },
    ]);
  });

  it('returns undefined outside the subset (css-not-emitted in resolve)', () => {
    expect(parseTrackList('repeat(auto-fill, 100px)')).toBeUndefined();
    expect(parseTrackList('[a] 1fr')).toBeUndefined();
    expect(parseTrackList('minmax(1fr, 100px)')).toBeUndefined();
  });
});

describe('placeItems', () => {
  it('auto-places by rows with span and explicit line', () => {
    const placed = placeItems(
      [{ column: AUTO, row: AUTO }, { column: at('span 2'), row: AUTO }, { column: AUTO, row: at(1) }, { column: at('1 / -1'), row: AUTO }],
      3,
      0,
    );
    expect(placed.areas).toEqual([
      { rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 2 },
      { rowStart: 1, rowEnd: 2, columnStart: 0, columnEnd: 2 },
      { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
      { rowStart: 2, rowEnd: 3, columnStart: 0, columnEnd: 3 },
    ]);
  });

  it('places an item with an explicit row before the automatic ones', () => {
    const placed = placeItems([{ column: AUTO, row: AUTO }, { column: AUTO, row: at(1) }], 3, 0);
    expect(placed.areas[1]).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 });
    expect(placed.areas[0]).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 2 });
  });
});

describe('sizeTracks', () => {
  const item = (start: number, end: number, min: number, max: number = min): SizingItem => ({ start, end, contribution: { min, max } });

  it('fr splits the space left after fixed tracks and gaps', () => {
    expect(sizeTracks(parseTrackList('200px 1fr 2fr')!, [], 620, 10)).toEqual([200, 133.33333333333334, 266.6666666666667]);
  });

  it('1fr keeps the min-content; minmax(0, 1fr) does not', () => {
    expect(sizeTracks(parseTrackList('1fr 1fr')!, [item(0, 1, 400)], 500, 0)).toEqual([400, 100]);
    expect(sizeTracks(parseTrackList('minmax(0, 1fr) minmax(0, 1fr)')!, [item(0, 1, 400)], 500, 0)).toEqual([250, 250]);
  });

  it('auto grows to max-content and stretches the rest evenly', () => {
    expect(sizeTracks(parseTrackList('auto auto')!, [item(0, 1, 40, 40), item(1, 2, 60, 200)], 500, 0)).toEqual([170, 330]);
  });

  it('indefinite size: fr tracks follow the largest contribution', () => {
    expect(sizeTracks(parseTrackList('1fr 1fr')!, [item(0, 1, 30), item(1, 2, 70)], undefined, 0)).toEqual([70, 70]);
  });

  it('span distributes the missing size across intrinsic tracks', () => {
    expect(sizeTracks(parseTrackList('auto auto')!, [item(0, 2, 110, 110)], undefined, 10)).toEqual([50, 50]);
  });

  it('areaRect sums tracks and gaps of the area', () => {
    expect(areaRect({ rowStart: 0, rowEnd: 2, columnStart: 1, columnEnd: 3 }, [100, 50, 50], [20, 30], 10, 5)).toEqual({ x: 110, y: 0, width: 110, height: 55 });
  });
});
