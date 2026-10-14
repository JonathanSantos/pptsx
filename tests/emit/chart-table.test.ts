import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { emitPptx, type EmitOptions } from '../../src/emit/index.ts';
import type { ChartData, ChartProps, LineBreaks, PositionedNode, TableProps } from '../../src/core/types.ts';
import { chartColorOf } from '../../src/core/defaults.ts';
import { fakeParagraphLayout, fakeTextLayout, pChart, pDeck, pSlide, pTable, rect, tableTextRows } from '../helpers/nodes.ts';

/**
 * CONTRACTS §M10 "src/emit/ (M10-D)": Table → <a:tbl> nativa com as larguras/alturas e quebras do layout;
 * Chart → ppt/charts/chartN.xml nativo. Só o que está fixo no contrato (sem margin, cuja unidade sai do spike).
 */

const EMU_PER_PT = 12700;

const open = async (children: readonly PositionedNode[], options: Partial<EmitOptions> = {}) => {
  const buffer = await emitPptx(pDeck([pSlide(children)]), { baseDir: '/tmp', ...options });
  const zip = await JSZip.loadAsync(buffer);
  const read = async (path: string): Promise<string> => {
    const file = zip.file(path);
    if (!file) throw new Error(`missing ${path} in pptx; have ${Object.keys(zip.files).join(', ')}`);
    return file.async('string');
  };
  return { zip, read };
};

const slideXml = async (children: readonly PositionedNode[], lineBreaks?: LineBreaks) =>
  (await open(children, lineBreaks === undefined ? {} : { lineBreaks })).read('ppt/slides/slide1.xml');

const all = (xml: string, re: RegExp): RegExpMatchArray[] => [...xml.matchAll(new RegExp(re.source, 'g'))];
const count = (xml: string, re: RegExp): number => all(xml, re).length;

const expectEmu = (actual: string | undefined, pt: number): void => {
  expect(actual, `EMU for ${pt} pt`).toBeDefined();
  expect(Math.abs(Number(actual) - pt * EMU_PER_PT)).toBeLessThanOrEqual(1);
};

/** Cada <a:tr>…</a:tr>, na ordem. */
const rowsXml = (xml: string): string[] => all(xml, /<a:tr\b[\s\S]*?<\/a:tr>/).map((m) => m[0]);
/** Cada <a:tc>…</a:tc> de uma linha, na ordem. */
const cellsXml = (row: string): string[] => all(row, /<a:tc\b[\s\S]*?<\/a:tc>/).map((m) => m[0]);
/** Textos dos runs (<a:t>) de uma célula, na ordem. */
const runTexts = (cell: string): string[] => all(cell, /<a:t>([^<]*)<\/a:t>/).map((m) => m[1] ?? '');
/** Quebras dentro da célula: soft breaks + fronteiras de parágrafo. */
const breaksIn = (cell: string): number => count(cell, /<a:br\/>/) + Math.max(0, count(cell, /<a:p>/) - 1);

// ───────────── Table ─────────────

const COLUMNS = [{ header: 'Área' }, { header: 'Q2', align: 'right' as const }, { header: 'Q3' }];
const HEADER_FILL = '#1F2937';
const STRIPE = '#EEF2F7';

const tableProps = (over: Partial<TableProps> = {}): TableProps => ({
  columns: COLUMNS,
  rows: [
    ['Varejo', '21,3', '32,0'],
    ['Seguros de vida', '9,8', '10,1'],
    ['Crédito', '4,0', '5,5'],
  ],
  header: { fill: HEADER_FILL, color: '#FFFFFF' },
  stripe: STRIPE,
  size: 12,
  ...over,
});

/** 'Seguros de vida' quebrada pelo layout em duas linhas na coluna 0 (um parágrafo do autor). */
const table = (over: Partial<TableProps> = {}) => {
  const props = tableProps(over);
  const cells = tableTextRows(props).map((row) =>
    row.map((c) => (c === 'Seguros de vida' ? fakeParagraphLayout([['Seguros de', 'vida']], 12) : fakeTextLayout(c, 12))),
  );
  return pTable(rect(36, 72, 540, 200), props, { columnWidths: [240, 150, 150], fontSize: 12, cells });
};

describe('emit — Table', () => {
  it('emits a native <a:tbl> with one <a:gridCol> per column, widths in EMU', async () => {
    const xml = await slideXml([table()]);
    expect(xml).toContain('<a:tbl>');
    const cols = all(xml, /<a:gridCol w="(\d+)"/);
    expect(cols).toHaveLength(3);
    [240, 150, 150].forEach((pt, i) => expectEmu(cols[i]?.[1], pt));
  });

  it('one <a:tr> per row (header included), heights = rowHeights in EMU', async () => {
    const t = table();
    const xml = await slideXml([t]);
    const heights = all(xml, /<a:tr h="(\d+)"/);
    expect(heights).toHaveLength(t.rowHeights.length);
    expect(t.rowHeights).toHaveLength(4);
    t.rowHeights.forEach((pt, i) => expectEmu(heights[i]?.[1], pt));
  });

  it('places the table at the frame origin', async () => {
    const xml = await slideXml([table()]);
    const frame = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"/.exec(xml);
    expectEmu(frame?.[1], 36);
    expectEmu(frame?.[2], 72);
  });

  it('cell text keeps the computed line breaks (forced)', async () => {
    const xml = await slideXml([table()]);
    const cell = cellsXml(rowsXml(xml)[2] ?? '')[0] ?? '';
    expect(runTexts(cell).join('|')).toBe('Seguros de|vida');
    expect(breaksIn(cell)).toBe(1);
  });

  it('single-line cells have no break', async () => {
    const xml = await slideXml([table()]);
    const cell = cellsXml(rowsXml(xml)[1] ?? '')[0] ?? '';
    expect(runTexts(cell).join('|')).toBe('Varejo');
    expect(breaksIn(cell)).toBe(0);
  });

  it('lineBreaks "auto": one run with the original cell text', async () => {
    const xml = await slideXml([table()], 'auto');
    const cell = cellsXml(rowsXml(xml)[2] ?? '')[0] ?? '';
    expect(runTexts(cell)).toEqual(['Seguros de vida']);
  });

  it('font size = node.fontSize × 100 in sz', async () => {
    const xml = await slideXml([table()]);
    const sizes = all(xml.slice(xml.indexOf('<a:tbl>')), /<a:rPr\b[^>]*\bsz="(\d+)"/).map((m) => m[1]);
    expect(sizes.length).toBeGreaterThan(0);
    expect(new Set(sizes)).toEqual(new Set(['1200']));
  });

  it('uses node.fontSize (after fit), not props.size', async () => {
    const t = { ...table(), fontSize: 10 };
    const xml = await slideXml([t]);
    const sizes = all(xml.slice(xml.indexOf('<a:tbl>')), /<a:rPr\b[^>]*\bsz="(\d+)"/).map((m) => m[1]);
    expect(new Set(sizes)).toEqual(new Set(['1000']));
  });

  it('b="1" only in the header row', async () => {
    const rows = rowsXml(await slideXml([table()]));
    expect(rows[0]).toMatch(/<a:rPr\b[^>]*\bb="1"/);
    for (const row of rows.slice(1)) expect(row).not.toMatch(/\bb="1"/);
  });

  it('header weight regular → no bold anywhere', async () => {
    const rows = rowsXml(await slideXml([table({ header: { weight: 'regular' } })]));
    for (const row of rows) expect(row).not.toMatch(/\bb="1"/);
  });

  it('header fill on the header row; stripe on odd data rows (2nd, 4th…)', async () => {
    const rows = rowsXml(await slideXml([table()]));
    const fill = HEADER_FILL.slice(1);
    const stripe = STRIPE.slice(1);
    expect(rows[0]).toContain(`<a:srgbClr val="${fill}"/>`);
    expect(rows[1]).not.toContain(stripe); // 1ª linha de dados
    expect(rows[2]).toContain(`<a:srgbClr val="${stripe}"/>`); // 2ª
    expect(rows[3]).not.toContain(stripe); // 3ª
    for (const row of rows.slice(1)) expect(row).not.toContain(fill);
  });

  it('header: false → no header row', async () => {
    const xml = await slideXml([table({ header: false })]);
    expect(rowsXml(xml)).toHaveLength(3);
    expect(xml).not.toContain('<a:t>Área</a:t>');
    expect(xml).not.toMatch(/\bb="1"/);
  });

  it('colors are written without #', async () => {
    const xml = await slideXml([table()]);
    expect(xml).not.toMatch(/val="#/);
  });
});

// ───────────── Chart ─────────────

const BAR_DATA: ChartData = {
  categories: ['Q4 25', 'Q1 26', 'Q2 26', 'Q3 26'],
  series: [
    { name: 'Receita', values: [38.2, 41.5, 45.9, 52.4] },
    { name: 'Custo', values: [20, 22, 25, 27] },
  ],
};
const PIE_DATA: ChartData = { categories: ['A', 'B', 'C'], series: [{ name: 'Mix', values: [50, 30, 20] }] };

const chartNode = (props: Partial<ChartProps> = {}) =>
  pChart(rect(36, 72, 480, 270), { kind: 'bar', data: BAR_DATA, ...props } as ChartProps);

const chartXml = async (props: Partial<ChartProps> = {}) => (await open([chartNode(props)])).read('ppt/charts/chart1.xml');

describe('emit — Chart', () => {
  it.each([
    ['bar', BAR_DATA, '<c:barChart>'],
    ['line', BAR_DATA, '<c:lineChart>'],
    ['pie', PIE_DATA, '<c:pieChart>'],
  ] as const)('%s → ppt/charts/chart1.xml with %s', async (kind, data, tag) => {
    const xml = await chartXml({ kind, data });
    expect(xml).toContain(tag);
  });

  it('[Content_Types].xml references the chart part', async () => {
    const types = await (await open([chartNode()])).read('[Content_Types].xml');
    expect(types).toMatch(/PartName="\/ppt\/charts\/chart1\.xml"[^>]*drawingml\.chart\+xml/);
  });

  it('the slide holds a chart graphic frame', async () => {
    const xml = await slideXml([chartNode()]);
    expect(xml).toContain('<p:graphicFrame>');
    expect(xml).toMatch(/drawingml\/2006\/chart/);
  });

  it('series colors are written without # (bar/line: per series)', async () => {
    const xml = await chartXml();
    const props = chartNode().props;
    for (const i of [0, 1]) expect(xml).toContain(`<a:srgbClr val="${chartColorOf(props, i).slice(1)}"`);
    expect(xml).not.toMatch(/val="#/);
  });

  it('author colors are used', async () => {
    const xml = await chartXml({ colors: ['#123456', '#ABCDEF'] });
    expect(xml).toContain('<a:srgbClr val="123456"');
    expect(xml).toContain('<a:srgbClr val="ABCDEF"');
  });

  it('pie colors go per category', async () => {
    const xml = await chartXml({ kind: 'pie', data: PIE_DATA, colors: ['#111111', '#222222', '#333333'] });
    for (const c of ['111111', '222222', '333333']) expect(xml).toContain(`<a:srgbClr val="${c}"`);
  });

  it('legend present with 2 series by default, absent with legend={false}', async () => {
    expect(await chartXml()).toContain('<c:legend>');
    expect(await chartXml({ legend: false })).not.toContain('<c:legend>');
  });

  it('one series → no legend by default; legend={true} forces it', async () => {
    const one: ChartData = { categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] };
    expect(await chartXml({ data: one })).not.toContain('<c:legend>');
    expect(await chartXml({ data: one, legend: true })).toContain('<c:legend>');
  });

  it('pie → legend by default', async () => {
    expect(await chartXml({ kind: 'pie', data: PIE_DATA })).toContain('<c:legend>');
  });

  it('title → <c:title> with the text', async () => {
    const xml = await chartXml({ title: 'Receita por trimestre' });
    const title = /<c:title>[\s\S]*?<\/c:title>/.exec(xml)?.[0] ?? '';
    expect(title).toContain('Receita por trimestre');
  });

  it('no title → no chart title', async () => {
    expect(await chartXml()).not.toMatch(/<c:title>[\s\S]*?Receita por trimestre/);
  });

  it('category names and values are in the chart data', async () => {
    const xml = await chartXml();
    for (const c of BAR_DATA.categories) expect(xml).toContain(c);
    expect(xml).toContain('Receita');
    expect(xml).toContain('52.4');
  });

  it('two charts → chart1.xml and chart2.xml', async () => {
    const { zip } = await open([chartNode(), chartNode({ kind: 'line' })]);
    expect(zip.file('ppt/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/chart2.xml')).not.toBeNull();
  });
});
