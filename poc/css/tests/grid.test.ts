import { describe, expect, it } from 'vitest';
import { parseGridPlacement } from '../resolve/values.ts';
import { areaRect, parseTrackList, placeItems, sizeTracks, type SizingItem } from '../layout/grid.ts';
import type { GridPlacement } from '../types.ts';

/** grid.ts puro: sintaxe de tracks, placement e track sizing (casos calculados à mão). */

const AUTO: GridPlacement = { start: { kind: 'auto' }, end: { kind: 'auto' } };
const at = (value: string | number): GridPlacement => parseGridPlacement(value)!;

describe('parseTrackList', () => {
  it('repeat, minmax, fr, %, px e auto', () => {
    expect(parseTrackList('repeat(2, 1fr) 100px minmax(0, 2fr) 25% auto')).toEqual([
      { min: { kind: 'auto' }, max: { kind: 'fr', value: 1 } },
      { min: { kind: 'auto' }, max: { kind: 'fr', value: 1 } },
      { min: { kind: 'fixed', value: 100 }, max: { kind: 'fixed', value: 100 } },
      { min: { kind: 'fixed', value: 0 }, max: { kind: 'fr', value: 2 } },
      { min: { kind: 'percent', value: 25 }, max: { kind: 'percent', value: 25 } },
      { min: { kind: 'auto' }, max: { kind: 'auto' } },
    ]);
  });

  it('fora do subconjunto devolve undefined (vira css-not-emitted no resolve)', () => {
    expect(parseTrackList('repeat(auto-fill, 100px)')).toBeUndefined();
    expect(parseTrackList('[a] 1fr')).toBeUndefined();
    expect(parseTrackList('minmax(1fr, 100px)')).toBeUndefined();
  });
});

describe('placeItems', () => {
  it('auto-placement em linhas, com span e linha definida', () => {
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

  it('item com linha definida vai para a 1ª coluna livre daquela linha antes dos automáticos', () => {
    const placed = placeItems([{ column: AUTO, row: AUTO }, { column: AUTO, row: at(1) }], 3, 0);
    expect(placed.areas[1]).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 });
    expect(placed.areas[0]).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 2 });
  });
});

describe('sizeTracks', () => {
  const item = (start: number, end: number, min: number, max: number = min): SizingItem => ({ start, end, contribution: { min, max } });

  it('fr divide o espaço depois das fixas e dos gaps', () => {
    expect(sizeTracks(parseTrackList('200px 1fr 2fr')!, [], 620, 10)).toEqual([200, 133.33333333333334, 266.6666666666667]);
  });

  it('1fr não fica abaixo do min-content do item; minmax(0, 1fr) fica', () => {
    expect(sizeTracks(parseTrackList('1fr 1fr')!, [item(0, 1, 400)], 500, 0)).toEqual([400, 100]);
    expect(sizeTracks(parseTrackList('minmax(0, 1fr) minmax(0, 1fr)')!, [item(0, 1, 400)], 500, 0)).toEqual([250, 250]);
  });

  it('auto: maximiza até o max-content e estica igual o que sobrar', () => {
    expect(sizeTracks(parseTrackList('auto auto')!, [item(0, 1, 40, 40), item(1, 2, 60, 200)], 500, 0)).toEqual([170, 330]);
  });

  it('tamanho indefinido: fr pela maior contribuição (todas as linhas 1fr ficam iguais)', () => {
    expect(sizeTracks(parseTrackList('1fr 1fr')!, [item(0, 1, 30), item(1, 2, 70)], undefined, 0)).toEqual([70, 70]);
  });

  it('span distribui o que falta entre os tracks intrínsecos', () => {
    expect(sizeTracks(parseTrackList('auto auto')!, [item(0, 2, 110, 110)], undefined, 10)).toEqual([50, 50]);
  });

  it('areaRect soma tracks e gaps da área', () => {
    expect(areaRect({ rowStart: 0, rowEnd: 2, columnStart: 1, columnEnd: 3 }, [100, 50, 50], [20, 30], 10, 5)).toEqual({ x: 110, y: 0, width: 110, height: 55 });
  });
});
