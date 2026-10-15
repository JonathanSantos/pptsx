import { describe, expect, it } from 'vitest';
import { chartSvg, slideToSvg, tableSvg, type SvgOptions } from '../../src/preview/index.ts';
import type { ChartData, ChartProps, PositionedNode, Rect, TableProps } from '../../src/core/types.ts';
import { chartColorOf } from '../../src/core/defaults.ts';
import { SIZE_16X9, pChart, pSlide, pTable, rect } from '../helpers/nodes.ts';
import { findElements, isRed, num, styleOf, textOf, type SvgElement } from '../helpers/svg.ts';

/** CONTRACTS §M10 "src/preview/ (M10-E)": SVG próprio de Table e Chart. */

const options = (over: Partial<SvgOptions> = {}): SvgOptions => ({
  widthPx: 1280,
  baseDir: '/base',
  readFile: () => Buffer.alloc(0),
  ...over,
});

/** Tira <defs>/<clipPath>: o retângulo de recorte não é célula nem barra. */
const drawn = (svg: string): string => svg.replace(/<defs[\s\S]*?<\/defs>/g, '').replace(/<clipPath[\s\S]*?<\/clipPath>/g, '');

const fillOf = (el: SvgElement): string => (styleOf(el, 'fill') ?? '').trim().toLowerCase();
const withFill = (els: readonly SvgElement[], color: string): SvgElement[] => els.filter((e) => fillOf(e) === color.toLowerCase());
const texts = (svg: string): string[] => findElements(drawn(svg), 'text').map(textOf);

// ───────────── Table ─────────────

const COLUMNS = [{ header: 'Área' }, { header: 'Q2', align: 'right' as const }, { header: 'Q3' }];
const ROWS = [
  ['Varejo', '21,3', '32,0'],
  ['Crédito', '9,8', '10,1'],
  ['Seguros\nVida', '4,0', '5,5'],
  ['Outros', '1,0', '2,0'],
];
const STRIPE = '#EEF2F7';
const HEADER_FILL = '#1F2937';

const tableProps = (over: Partial<TableProps> = {}): TableProps => ({
  columns: COLUMNS,
  rows: ROWS,
  header: { fill: HEADER_FILL, color: '#FFFFFF' },
  stripe: STRIPE,
  ...over,
});

/** Frame exatamente da altura da tabela (5 linhas; a 4ª linha de dados tem 2 linhas de texto). */
const fitted = (props: TableProps = tableProps()) => {
  const probe = pTable(rect(40, 40, 600, 0), props);
  return pTable(rect(40, 40, 600, probe.height), props);
};

describe('tableSvg', () => {
  it('draws a <rect> only for filled cells (header fill + striped data rows) and the grid as <line>s', () => {
    const t = fitted();
    const svg = tableSvg(t, {});
    expect(t.cells).toHaveLength(5);
    // cabeçalho (3) + linhas de dados pares (2ª e 4ª → 2 × 3)
    expect(findElements(drawn(svg), 'rect')).toHaveLength(3 + 2 * 3);
    // sem border não há grade; com border: (linhas + 1) horizontais + (colunas + 1) verticais
    expect(findElements(drawn(svg), 'line')).toHaveLength(0);
    const bordered = tableSvg(fitted(tableProps({ border: '#CCCCCC' })), {});
    expect(findElements(drawn(bordered), 'line')).toHaveLength(5 + 1 + 3 + 1);
  });

  it('draws one <text> per cell line', () => {
    const t = fitted();
    const lines = t.cells.flat().reduce((n, c) => n + c.lines.length, 0);
    expect(lines).toBe(5 * 3 + 1);
    expect(findElements(drawn(tableSvg(t, {})), 'text')).toHaveLength(lines);
  });

  it('cell text appears in the SVG', () => {
    const all = texts(tableSvg(fitted(), {})).join('|');
    for (const s of ['Área', 'Varejo', '21,3', 'Seguros', 'Vida', 'Outros']) expect(all).toContain(s);
  });

  it('header cells use the header fill', () => {
    const rects = findElements(drawn(tableSvg(fitted(), {})), 'rect');
    expect(withFill(rects, HEADER_FILL)).toHaveLength(3);
  });

  it('stripe fills the even data rows (2nd, 4th)', () => {
    const t = fitted();
    const rects = findElements(drawn(tableSvg(t, {})), 'rect');
    const striped = withFill(rects, STRIPE);
    expect(striped).toHaveLength(2 * 3);
    const top = t.frame.y;
    const rowTop = (r: number) => top + t.rowHeights.slice(0, r).reduce((a, b) => a + b, 0);
    // linhas de cells: 0 = cabeçalho, 2 = 2ª de dados, 4 = 4ª de dados
    const ys = [...new Set(striped.map((r) => Math.round(num(r.attrs.y) * 100) / 100))].sort((a, b) => a - b);
    expect(ys).toEqual([rowTop(2), rowTop(4)].map((y) => Math.round(y * 100) / 100));
  });

  it('no stripe → no striped rects', () => {
    const rects = findElements(drawn(tableSvg(fitted(tableProps({ stripe: undefined })), {})), 'rect');
    expect(withFill(rects, STRIPE)).toHaveLength(0);
  });

  it('header: false → only striped rects and no header text', () => {
    const t = fitted(tableProps({ header: false }));
    const svg = tableSvg(t, {});
    // zebra nas linhas de dados de índice ímpar (2ª e 4ª de 4)
    expect(findElements(drawn(svg), 'rect')).toHaveLength(2 * 3);
    expect(texts(svg)).not.toContain('Área');
  });

  it('header text is bold with the header color', () => {
    const header = findElements(drawn(tableSvg(fitted(), {})), 'text').find((e) => textOf(e).includes('Área'));
    expect(header).toBeDefined();
    expect(header!.raw).toMatch(/font-weight\s*[:=]\s*"?bold/);
    expect(header!.raw.toLowerCase()).toContain('#ffffff');
  });

  it('right-aligned column uses text-anchor end', () => {
    const cell = findElements(drawn(tableSvg(fitted(), {})), 'text').find((e) => textOf(e).includes('21,3'));
    expect(cell?.raw).toMatch(/text-anchor\s*[:=]\s*"?end/);
  });

  it('font family goes through fontFamilyMap', () => {
    const svg = tableSvg(fitted(), { fontFamilyMap: { Arial: 'Liberation Sans' } });
    expect(svg).toContain('Liberation Sans');
  });
});

// ───────────── Chart ─────────────

const CATEGORIES = ['Q4 25', 'Q1 26', 'Q2 26', 'Q3 26'];
const BAR_DATA: ChartData = {
  categories: CATEGORIES,
  series: [
    { name: 'Receita', values: [10, 20, 30, 40] },
    { name: 'Custo', values: [5, 15, 25, 35] },
  ],
};
const CHART_FRAME: Rect = rect(40, 40, 600, 300);

const chart = (props: Partial<ChartProps> = {}) =>
  pChart(CHART_FRAME, { kind: 'bar', data: BAR_DATA, legend: false, ...props });

describe('chartSvg — bar', () => {
  const svg = () => chartSvg(chart(), {});
  const barsOf = (s: string, series: number) =>
    withFill(findElements(drawn(s), 'rect'), chartColorOf(chart().props, series));

  it('draws categories × series bar rects', () => {
    expect(barsOf(svg(), 0)).toHaveLength(4);
    expect(barsOf(svg(), 1)).toHaveLength(4);
  });

  it('bar heights are proportional to the values', () => {
    const s = svg();
    const bars = [...barsOf(s, 0), ...barsOf(s, 1)];
    const values = [...BAR_DATA.series[0]!.values!, ...BAR_DATA.series[1]!.values!];
    const ratio = num(bars[0]!.attrs.height) / values[0]!;
    bars.forEach((bar, i) => {
      expect(num(bar.attrs.height) / values[i]!, `bar ${i}`).toBeCloseTo(ratio, 6 - 4);
      expect(Math.abs(num(bar.attrs.height) / values[i]! / ratio - 1)).toBeLessThan(0.01);
    });
  });

  it('bars stay inside the frame', () => {
    for (const bar of [...barsOf(svg(), 0), ...barsOf(svg(), 1)]) {
      expect(num(bar.attrs.x)).toBeGreaterThanOrEqual(CHART_FRAME.x - 0.01);
      expect(num(bar.attrs.y)).toBeGreaterThanOrEqual(CHART_FRAME.y - 0.01);
      expect(num(bar.attrs.x) + num(bar.attrs.width)).toBeLessThanOrEqual(CHART_FRAME.x + CHART_FRAME.width + 0.01);
      expect(num(bar.attrs.y) + num(bar.attrs.height)).toBeLessThanOrEqual(CHART_FRAME.y + CHART_FRAME.height + 0.01);
    }
  });

  it('author colors are used per series', () => {
    const s = chartSvg(chart({ colors: ['#123456', '#654321'] }), {});
    expect(withFill(findElements(drawn(s), 'rect'), '#123456')).toHaveLength(4);
    expect(withFill(findElements(drawn(s), 'rect'), '#654321')).toHaveLength(4);
  });

  it('category labels appear', () => {
    const all = texts(svg()).join('|');
    for (const c of CATEGORIES) expect(all).toContain(c);
  });
});

describe('chartSvg — legend and title', () => {
  it('legend lists series names only when legend is on', () => {
    const on = texts(chartSvg(chart({ legend: true }), {})).join('|');
    expect(on).toContain('Receita');
    expect(on).toContain('Custo');
    const off = texts(chartSvg(chart({ legend: false }), {})).join('|');
    expect(off).not.toContain('Receita');
    expect(off).not.toContain('Custo');
  });

  it('default legend: on for 2 series', () => {
    const s = chartSvg(pChart(CHART_FRAME, { kind: 'bar', data: BAR_DATA }), {});
    expect(texts(s).join('|')).toContain('Receita');
  });

  it('title appears', () => {
    expect(texts(chartSvg(chart({ title: 'Receita por trimestre' }), {})).join('|')).toContain('Receita por trimestre');
  });

  it('no title → no title text', () => {
    expect(texts(chartSvg(chart(), {})).join('|')).not.toContain('Receita por trimestre');
  });
});

describe('chartSvg — line', () => {
  it('draws one <polyline> per series', () => {
    expect(findElements(drawn(chartSvg(chart({ kind: 'line' }), {})), 'polyline')).toHaveLength(2);
  });

  it('each polyline has one point per category', () => {
    for (const line of findElements(drawn(chartSvg(chart({ kind: 'line' }), {})), 'polyline')) {
      const coords = (line.attrs.points ?? '').trim().split(/[\s,]+/).filter(Boolean);
      expect(coords).toHaveLength(CATEGORIES.length * 2);
    }
  });
});

describe('chartSvg — pie', () => {
  const PIE: ChartData = { categories: ['A', 'B', 'C'], series: [{ name: 'Mix', values: [50, 30, 20] }] };
  const pie = (over: Partial<ChartProps> = {}) => pChart(CHART_FRAME, { kind: 'pie', data: PIE, ...over });

  it('draws one <path> per category, colored by category', () => {
    const paths = findElements(drawn(chartSvg(pie(), {})), 'path');
    PIE.categories!.forEach((_, i) => expect(withFill(paths, chartColorOf(pie().props, i)), `slice ${i}`).toHaveLength(1));
  });

  it('legend on by default lists categories', () => {
    const all = texts(chartSvg(pie(), {})).join('|');
    for (const c of PIE.categories!) expect(all).toContain(c);
  });
});

// ───────────── slideToSvg ─────────────

/** Retângulos com preenchimento vermelho visível. */
const redFills = (svg: string): SvgElement[] => findElements(svg, 'rect').filter((r) => isRed(styleOf(r, 'fill')));

const covers = (el: SvgElement, area: Rect, tol = 0.01): boolean => {
  const x = num(el.attrs.x);
  const y = num(el.attrs.y);
  const w = num(el.attrs.width);
  const h = num(el.attrs.height);
  return x <= area.x + tol && y <= area.y + tol && x + w >= area.x + area.width - tol && y + h >= area.y + area.height - tol;
};

describe('slideToSvg — chart and table', () => {
  const svgOf = (children: readonly PositionedNode[], debug: boolean) =>
    slideToSvg(pSlide(children), SIZE_16X9, options({ debug }));

  it('renders table cells and chart bars in the slide', () => {
    const svg = svgOf([fitted(), chart()], false);
    expect(texts(svg).join('|')).toContain('Varejo');
    expect(withFill(findElements(svg, 'rect'), chartColorOf(chart().props, 0)).length).toBeGreaterThanOrEqual(4);
  });

  // Tabela de 5 linhas × 28 pt = 140 pt num frame de 60 pt.
  const overflowing = () => pTable(rect(50, 50, 300, 60), tableProps({ rows: ROWS.slice(0, 2).concat([['a', 'b', 'c'], ['d', 'e', 'f']]) }));

  it('debug: an overflowing table gets the overflow band', () => {
    const t = overflowing();
    expect(t.height).toBe(140);
    const band: Rect = { x: 50, y: 110, width: 300, height: 80 };
    expect(redFills(svgOf([t], true)).some((r) => covers(r, band))).toBe(true);
  });

  it('debug: a table that fits gets no band', () => {
    expect(redFills(svgOf([fitted()], true))).toHaveLength(0);
  });

  it('debug: no band when a cell has fontMissing (estimated measure)', () => {
    const t = overflowing();
    const cells = t.cells.map((row, r) => row.map((c, col) => (r === 1 && col === 0 ? { ...c, fontMissing: true } : c)));
    expect(redFills(svgOf([{ ...t, cells }], true))).toHaveLength(0);
  });

  it('without debug: no band', () => {
    expect(redFills(svgOf([overflowing()], false))).toHaveLength(0);
  });
});
