import { describe, expect, it } from 'vitest';
import type { ChartProps, TableProps } from '../../src/core/types.ts';
import { DEFAULTS, chartColorOf, chartLegendOf, tableHeaderOf, tableMinSizeOf } from '../../src/core/defaults.ts';

/** CONTRACTS §M10: helpers de padrão de Chart e Table em core/defaults.ts. */

const table = (over: Partial<TableProps> = {}): TableProps => ({
  columns: [{ header: 'A' }],
  rows: [['1']],
  ...over,
});

const chart = (over: Partial<ChartProps> = {}): ChartProps => ({
  kind: 'bar',
  data: { categories: ['a', 'b'], series: [{ name: 's1', values: [1, 2] }] },
  ...over,
});

const TWO_SERIES = {
  categories: ['a', 'b'],
  series: [
    { name: 's1', values: [1, 2] },
    { name: 's2', values: [3, 4] },
  ],
};

describe('tableMinSizeOf', () => {
  it('default size 14 hits the legible floor (10)', () => {
    expect(DEFAULTS.table.size).toBe(14);
    expect(tableMinSizeOf(table())).toBe(10);
  });

  it('size 20 → floor(20 × 0.75) = 15', () => {
    expect(tableMinSizeOf(table({ size: 20 }))).toBe(15);
  });

  it('author minSize wins, even below the floor', () => {
    expect(tableMinSizeOf(table({ size: 20, minSize: 8 }))).toBe(8);
    expect(tableMinSizeOf(table({ minSize: 13 }))).toBe(13);
  });
});

describe('tableHeaderOf', () => {
  it('false → no header', () => {
    expect(tableHeaderOf(table({ header: false }))).toBeUndefined();
  });

  it('absent → the default header (bold)', () => {
    expect(tableHeaderOf(table())).toEqual({ weight: 'bold' });
  });

  it('merges author style over bold', () => {
    expect(tableHeaderOf(table({ header: { fill: '#112233', color: '#FFFFFF' } }))).toEqual({
      weight: 'bold',
      fill: '#112233',
      color: '#FFFFFF',
    });
  });

  it('author weight overrides bold', () => {
    expect(tableHeaderOf(table({ header: { weight: 'regular' } }))?.weight).toBe('regular');
  });
});

describe('chartColorOf', () => {
  it('uses the author color when given', () => {
    const props = chart({ colors: ['#AA0000', '#00BB00'] });
    expect(chartColorOf(props, 0)).toBe('#AA0000');
    expect(chartColorOf(props, 1)).toBe('#00BB00');
  });

  it('falls back to the palette for missing author colors', () => {
    expect(chartColorOf(chart({ colors: ['#AA0000'] }), 1)).toBe(DEFAULTS.chart.palette[1]);
  });

  it('cycles through the palette', () => {
    const n = DEFAULTS.chart.palette.length;
    expect(chartColorOf(chart(), 0)).toBe(DEFAULTS.chart.palette[0]);
    expect(chartColorOf(chart(), n)).toBe(DEFAULTS.chart.palette[0]);
    expect(chartColorOf(chart(), n + 2)).toBe(DEFAULTS.chart.palette[2]);
  });
});

describe('chartLegendOf', () => {
  it('one series → false', () => {
    expect(chartLegendOf(chart())).toBe(false);
  });

  it('two series → true', () => {
    expect(chartLegendOf(chart({ data: TWO_SERIES }))).toBe(true);
  });

  it('pie → true even with one series', () => {
    expect(chartLegendOf(chart({ kind: 'pie' }))).toBe(true);
  });

  it('explicit legend wins', () => {
    expect(chartLegendOf(chart({ legend: true }))).toBe(true);
    expect(chartLegendOf(chart({ data: TWO_SERIES, legend: false }))).toBe(false);
    expect(chartLegendOf(chart({ kind: 'pie', legend: false }))).toBe(false);
  });
});
