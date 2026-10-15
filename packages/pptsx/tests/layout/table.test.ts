import { describe, expect, it } from 'vitest';
import { columnWidthsOf, layoutSlide, measureTable } from '../../src/layout/index.ts';
import type { LayoutEnv, PositionedNode, TableColumn, TableProps, TextMeasureInput } from '../../src/core/types.ts';
import { DEFAULTS, tableStyleOf } from '../../src/core/defaults.ts';
import {
  FAKE_LINE_HEIGHT,
  SIZE_16X9,
  createFakeEnv,
  fakeTextLayout,
  rChart,
  rSlide,
  rTable,
  rText,
} from '../helpers/nodes.ts';
import { child, expectFrame } from '../helpers/positioned.ts';

/** CONTRACTS §M10 "src/layout/ (M10-B)": larguras de coluna, medida das células e nós Yoga de Table/Chart. */

const PAD = DEFAULTS.table.cellPadding;
const CHAR_WIDTH = 10;

/** Medidor falso com largura: uma linha por '\n', 20 pt por linha, largura = caracteres × 10. Registra as chamadas. */
const charEnv = () => {
  const calls: TextMeasureInput[] = [];
  const env: LayoutEnv = {
    measureText: (input) => {
      calls.push(input);
      const base = fakeTextLayout(input.content, input.style.size);
      const width = Math.max(0, ...base.lines.map((l) => l.length * CHAR_WIDTH));
      return { ...base, width, widestSegment: width };
    },
    imageSize: () => ({ width: 400, height: 200 }),
  };
  return { env, calls };
};

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** M11 (colunas auto pelo conteúdo): as células são medidas antes sem limite (max-content); estas são as medidas finais, na coluna. */
const finalCalls = (calls: readonly TextMeasureInput[]): readonly TextMeasureInput[] => calls.filter((c) => c.maxWidth !== Infinity);

const expectWidths = (actual: readonly number[], expected: readonly number[]): void => {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((w, i) => expect(actual[i], `column ${i}`).toBeCloseTo(w, 6));
};

const TWO_FREE: readonly TableColumn[] = [{ header: 'A' }, { header: 'B' }];

const table = (over: Partial<TableProps> = {}) => rTable({ columns: TWO_FREE, rows: [['a', 'b']], ...over }, 'Slide > Table');

// ───────────── columnWidthsOf ─────────────

describe('columnWidthsOf', () => {
  it('40% + 3 free columns in 600 → [240, 120, 120, 120]', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: '40%' }, { header: 'b' }, { header: 'c' }, { header: 'd' }], 600), [
      240, 120, 120, 120,
    ]);
  });

  it('fixed pt + free columns split the rest equally', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: 100 }, { header: 'b' }, { header: 'c' }], 400), [100, 150, 150]);
  });

  it('pt + % + free', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: 100 }, { header: 'b', width: '25%' }, { header: 'c' }], 400), [100, 100, 200]);
  });

  it('all free → equal split', () => {
    expectWidths(columnWidthsOf([{ header: 'a' }, { header: 'b' }, { header: 'c' }], 300), [100, 100, 100]);
  });

  it('no free column and sum < width → scaled proportionally', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: 100 }, { header: 'b', width: 300 }], 800), [200, 600]);
  });

  it('no free column and sum > width → scaled proportionally', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: '50%' }, { header: 'b', width: '100%' }], 600), [200, 400]);
  });

  it('no free column and exact sum → unchanged', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: 200 }, { header: 'b', width: '50%' }], 400), [200, 200]);
  });

  it('fixed columns past the width → free get 0 and all scale to close the width', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: 500 }, { header: 'b' }], 400), [400, 0]);
  });

  it('no free column and sum 0 → equal split', () => {
    expectWidths(columnWidthsOf([{ header: 'a', width: 0 }, { header: 'b', width: '0%' }], 300), [150, 150]);
  });

  it('result sums to the table width', () => {
    const cases: readonly (readonly TableColumn[])[] = [
      [{ header: 'a', width: '33%' }, { header: 'b' }],
      [{ header: 'a', width: 70 }, { header: 'b', width: 90 }, { header: 'c', width: '10%' }],
      [{ header: 'a' }, { header: 'b' }, { header: 'c' }, { header: 'd' }, { header: 'e' }, { header: 'f' }, { header: 'g' }],
    ];
    for (const columns of cases) expect(sum(columnWidthsOf(columns, 517))).toBeCloseTo(517, 6);
  });
});

// ───────────── measureTable ─────────────

describe('measureTable', () => {
  it('measures each cell with maxWidth = column − 2 × padding and the table style', () => {
    const { env, calls } = charEnv();
    measureTable(table({ size: 16, font: 'Arial' }), 200, env);
    expect(finalCalls(calls).length).toBe(4); // cabeçalho + 1 linha × 2 colunas
    for (const call of finalCalls(calls)) {
      expect(call.maxWidth).toBeCloseTo(100 - 2 * PAD, 6);
      expect(call.style.size).toBe(16);
      expect(call.style.family).toBe(tableStyleOf({ columns: TWO_FREE, rows: [] }).family);
    }
  });

  it('header cells are measured bold, data cells regular', () => {
    const { env, calls } = charEnv();
    measureTable(table(), 200, env);
    const headerCalls = finalCalls(calls).filter((c) => c.content === 'A' || c.content === 'B');
    const dataCalls = finalCalls(calls).filter((c) => c.content === 'a' || c.content === 'b');
    expect(headerCalls.map((c) => c.style.weight)).toEqual(['bold', 'bold']);
    expect(dataCalls.map((c) => c.style.weight)).toEqual(['regular', 'regular']);
  });

  it('a header with regular weight is measured regular', () => {
    const { env, calls } = charEnv();
    measureTable(table({ header: { weight: 'regular' } }), 200, env);
    expect(calls.every((c) => c.style.weight === 'regular')).toBe(true);
  });

  it('rowHeights = tallest cell + 2 × padding', () => {
    const { env } = charEnv();
    const layout = measureTable(table({ rows: [['a', 'b'], ['c', 'd']] }), 200, env);
    expect(layout.rowHeights).toEqual([FAKE_LINE_HEIGHT + 2 * PAD, FAKE_LINE_HEIGHT + 2 * PAD, FAKE_LINE_HEIGHT + 2 * PAD]);
  });

  it('a cell with 3 lines sets the row height', () => {
    const { env } = charEnv();
    const layout = measureTable(table({ rows: [['um', 'a\nb\nc'], ['x', 'y']] }), 200, env);
    expect(layout.rowHeights[1]).toBe(3 * FAKE_LINE_HEIGHT + 2 * PAD);
    expect(layout.rowHeights[2]).toBe(FAKE_LINE_HEIGHT + 2 * PAD);
  });

  it('custom cellPadding applies on both sides', () => {
    const { env, calls } = charEnv();
    const layout = measureTable(table({ cellPadding: 10 }), 200, env);
    expect(layout.rowHeights).toEqual([FAKE_LINE_HEIGHT + 20, FAKE_LINE_HEIGHT + 20]);
    expect(finalCalls(calls)[0]?.maxWidth).toBeCloseTo(80, 6);
  });

  it('header is row 0 of cells', () => {
    const { env } = charEnv();
    const layout = measureTable(table(), 200, env);
    expect(layout.cells).toHaveLength(2);
    expect(layout.cells[0]?.map((c) => c.lines)).toEqual([['A'], ['B']]);
    expect(layout.cells[1]?.map((c) => c.lines)).toEqual([['a'], ['b']]);
  });

  it('header: false → no header row', () => {
    const { env } = charEnv();
    const layout = measureTable(table({ header: false, rows: [['a', 'b'], ['c', 'd']] }), 200, env);
    expect(layout.cells).toHaveLength(2);
    expect(layout.rowHeights).toHaveLength(2);
    expect(layout.cells[0]?.map((c) => c.lines)).toEqual([['a'], ['b']]);
  });

  it('rows: [] → only the header', () => {
    const { env } = charEnv();
    const layout = measureTable(table({ rows: [] }), 200, env);
    expect(layout.rowHeights).toEqual([FAKE_LINE_HEIGHT + 2 * PAD]);
  });

  it('height = Σ rowHeights', () => {
    const { env } = charEnv();
    const layout = measureTable(table({ rows: [['a\nb', 'c'], ['d', 'e\nf\ng']] }), 200, env);
    expect(layout.height).toBe(sum(layout.rowHeights));
    expect(layout.height).toBe(FAKE_LINE_HEIGHT + 2 * FAKE_LINE_HEIGHT + 3 * FAKE_LINE_HEIGHT + 3 * 2 * PAD);
  });

  it('finite width: columnWidths follow columnWidthsOf and width = tableWidth', () => {
    const { env } = charEnv();
    const columns: readonly TableColumn[] = [{ header: 'a', width: '40%' }, { header: 'b' }, { header: 'c' }, { header: 'd' }];
    const layout = measureTable(rTable({ columns, rows: [] }), 600, env);
    expectWidths(layout.columnWidths, [240, 120, 120, 120]);
    expect(layout.width).toBeCloseTo(600, 6);
  });

  it('Infinity width: every free column = its own max-content + 2 × padding (table-layout: auto)', () => {
    const { env, calls } = charEnv();
    const layout = measureTable(table({ rows: [['abc', 'x'], ['a', 'wxyzw']] }), Infinity, env);
    expect(calls.some((c) => c.maxWidth === Infinity)).toBe(true);
    expectWidths(layout.columnWidths, [3 * CHAR_WIDTH + 2 * PAD, 5 * CHAR_WIDTH + 2 * PAD]);
    expect(layout.width).toBeCloseTo(sum(layout.columnWidths), 6);
  });

  it('Infinity width: the widest cell of each free column stays on one line', () => {
    const { env } = charEnv();
    const layout = measureTable(table({ rows: [['abc', 'x'], ['a', 'wxyzw']] }), Infinity, env);
    expect(layout.rowHeights.every((h) => h === FAKE_LINE_HEIGHT + 2 * PAD)).toBe(true);
  });

  it('Infinity width: a pt column keeps its value; % is treated as free', () => {
    const { env } = charEnv();
    const columns: readonly TableColumn[] = [
      { header: 'a', width: 77 },
      { header: 'b', width: '50%' },
    ];
    const layout = measureTable(rTable({ columns, rows: [['x', 'abcd']] }), Infinity, env);
    // a coluna em pt não entra na "célula livre mais larga"
    expectWidths(layout.columnWidths, [77, 4 * CHAR_WIDTH + 2 * PAD]);
  });
});

// ───────────── via layoutSlide ─────────────

const COLUMNS4: readonly TableColumn[] = [{ header: 'Área', width: '40%' }, { header: 'Q2' }, { header: 'Q3' }, { header: 'Δ' }];

const tableAt = (node: PositionedNode) => {
  if (node.kind !== 'table') throw new Error(`expected table, got ${node.kind}`);
  return node;
};

describe('layoutSlide — Table', () => {
  const PADDING = 20;
  const contentWidth = SIZE_16X9.width - 2 * PADDING;

  const layout = (props: Partial<TableProps> = {}) =>
    layoutSlide(
      rSlide([rTable({ columns: COLUMNS4, rows: [['Varejo', '1', '2', '3']], ...props }, 'Slide > Table')], {
        padding: PADDING,
      }),
      SIZE_16X9,
      createFakeEnv().env,
    );

  it('stretches to the slide content width in a column', () => {
    const t = tableAt(child(layout(), 0));
    expect(t.frame.x).toBeCloseTo(PADDING, 6);
    expect(t.frame.y).toBeCloseTo(PADDING, 6);
    expect(t.frame.width).toBeCloseTo(contentWidth, 6);
  });

  it('frame height = measured height (content, no grow basis)', () => {
    const t = tableAt(child(layout(), 0));
    expect(t.height).toBe(2 * (FAKE_LINE_HEIGHT + 2 * PAD));
    expect(t.frame.height).toBeCloseTo(t.height, 6);
  });

  it('carries fontSize, columnWidths, rowHeights and cells', () => {
    const t = tableAt(child(layout(), 0));
    expect(t.fontSize).toBe(DEFAULTS.table.size);
    expectWidths(t.columnWidths, [contentWidth * 0.4, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2]);
    expect(sum(t.columnWidths)).toBeCloseTo(t.frame.width, 6);
    expect(t.rowHeights).toHaveLength(2);
    expect(t.cells).toHaveLength(2);
    expect(t.cells[0]).toHaveLength(4);
  });

  it('fontSize follows props.size', () => {
    expect(tableAt(child(layout({ size: 11 }), 0)).fontSize).toBe(11);
  });

  it('keeps resolved rows and props', () => {
    const t = tableAt(child(layout(), 0));
    expect(t.kind).toBe('table');
    expect(t.path).toBe('Slide > Table');
    expect(t.rows).toEqual([['Varejo', '1', '2', '3']]);
    expect(t.props.columns).toEqual(COLUMNS4);
  });

  it('a following sibling starts below the table', () => {
    const slide = layoutSlide(
      rSlide([rTable({ columns: TWO_FREE, rows: [['a', 'b']] }, 'Slide > Table'), rText('depois', {}, 'Slide > Text')]),
      SIZE_16X9,
      createFakeEnv().env,
    );
    const t = tableAt(child(slide, 0));
    expect(child(slide, 1).frame.y).toBeCloseTo(t.frame.y + t.height, 6);
  });
});

describe('layoutSlide — Chart', () => {
  const data = { categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] };

  it('grow={1} in a column takes the remaining height', () => {
    const slide = layoutSlide(
      rSlide([rText('Título', {}, 'Slide > Text'), rChart({ kind: 'bar', data, grow: 1 }, 'Slide > Chart')], { padding: 20 }),
      SIZE_16X9,
      createFakeEnv().env,
    );
    const chart = child(slide, 1);
    expect(chart.kind).toBe('chart');
    expectFrame(chart.frame, { x: 20, y: 20 + FAKE_LINE_HEIGHT, width: 680, height: SIZE_16X9.height - 40 - FAKE_LINE_HEIGHT });
  });

  it('height={200} is respected', () => {
    const slide = layoutSlide(
      rSlide([rChart({ kind: 'line', data, height: 200 }, 'Slide > Chart')]),
      SIZE_16X9,
      createFakeEnv().env,
    );
    expectFrame(child(slide, 0).frame, { x: 0, y: 0, width: SIZE_16X9.width, height: 200 });
  });

  it('width/height in a row are respected', () => {
    const slide = layoutSlide(
      rSlide([rChart({ kind: 'pie', data, width: 300, height: 150 }, 'Slide > Chart')], { direction: 'row', align: 'start' }),
      SIZE_16X9,
      createFakeEnv().env,
    );
    expectFrame(child(slide, 0).frame, { x: 0, y: 0, width: 300, height: 150 });
  });

  it('grow={1} siblings in a row split the width', () => {
    const slide = layoutSlide(
      rSlide(
        [rChart({ kind: 'bar', data, grow: 1 }, 'Slide > Chart[0]'), rChart({ kind: 'bar', data, grow: 1 }, 'Slide > Chart[1]')],
        { direction: 'row' },
      ),
      SIZE_16X9,
      createFakeEnv().env,
    );
    expect(child(slide, 0).frame.width).toBeCloseTo(360, 6);
    expect(child(slide, 1).frame.x).toBeCloseTo(360, 6);
  });
});
