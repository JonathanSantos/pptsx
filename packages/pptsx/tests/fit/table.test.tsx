import { describe, expect, it } from 'vitest';
import { detectOverflow } from '../../src/fit/index.ts';
import type { Diagnostic, PositionedNode, PositionedSlide, PositionedTable, TableColumn, TableProps } from '../../src/core/types.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import { Box, Slide, Table, Text } from '../../src/primitives/index.ts';
import { SIZE_16X9, pBox, pSlide, pTable, rect } from '../helpers/nodes.ts';
import { allNodes, atPath, byCode, fit, lazy, lineHeightAt, textAt } from '../helpers/fit-env.tsx';

/** CONTRACTS §M10 "src/fit/ (M10-C)": a tabela encolhe como uma unidade, com table-overflow quando não cabe. */

const PAD = DEFAULTS.table.cellPadding;
const EPSILON = DEFAULTS.fit.epsilon;
const COLUMNS: readonly TableColumn[] = [{ header: 'Área', width: '40%' }, { header: 'Q2' }, { header: 'Q3' }];

const rowsOf = (n: number): readonly (readonly string[])[] =>
  Array.from({ length: n }, (_, i) => [`Linha ${i + 1}`, String(i * 3), String(i * 7)]);

/**
 * Altura de uma linha de uma linha de texto no size dado (medidor real). M11: o layout arredonda
 * as linhas da tabela para cima a DEFAULTS.table.rowHeightStep (o passo do Keynote).
 */
const STEP = DEFAULTS.table.rowHeightStep;
const rowHeightAt = (size: number): number => Math.ceil((lineHeightAt(size) + 2 * PAD) / STEP - DEFAULTS.css.layoutNoise) * STEP;

const tableAt = (slide: PositionedSlide, path: string): PositionedTable => {
  const node = allNodes(slide).find((n): n is PositionedTable => n.kind === 'table' && n.path === path);
  if (!node) throw new Error(`no table at ${path}; have ${allNodes(slide).map((n) => n.path).join(', ')}`);
  return node;
};

const one = (ds: readonly Diagnostic[], code: Diagnostic['code']): Diagnostic => {
  const found = ds.filter((d) => d.code === code);
  expect(found, `${code} in ${JSON.stringify(ds.map((d) => [d.code, d.path]))}`).toHaveLength(1);
  return found[0]!;
};

/** Linhas de dados cujo fundo fica dentro da altura disponível (o cabeçalho não conta). */
const shownRowsOf = (t: PositionedTable, available: number): number => {
  let bottom = 0;
  let shown = 0;
  t.rowHeights.forEach((h, i) => {
    bottom += h;
    if (i > 0 && bottom <= available + EPSILON) shown += 1;
  });
  return shown;
};

const boxed = (height: number, props: Partial<TableProps> = {}) => (
  <Slide>
    <Box height={height}>
      <Table columns={COLUMNS} rows={rowsOf(20)} {...props} />
    </Box>
  </Slide>
);

const TABLE = 'Slide > Box > Table';

// ───────────── 20 linhas num Box de 200 pt ─────────────

describe('fit — 20-row table in a 200 pt box', () => {
  const result = lazy(() => fit(boxed(200)));

  it('shrinks the table (toSize < fromSize)', () => {
    const t = tableAt(result().slide, TABLE);
    expect(t.fontSize).toBeLessThan(DEFAULTS.table.size);
  });

  it('does not fit even at the minimum → table-overflow with shown/total rows', () => {
    const d = one(atPath(result(), TABLE), 'table-overflow');
    expect(d.severity).toBe('error');
    expect(d.data?.fromSize).toBe(14);
    expect(d.data?.toSize).toBe(10);
    expect(d.data?.totalRows).toBe(20);
    expect(d.data?.shownRows).toBeLessThan(20);
    expect(d.data?.overflowPt).toBeGreaterThan(0);
    expect(d.data?.overflowPct).toBeGreaterThan(0);
  });

  it('shownRows counts data rows inside the available height', () => {
    const t = tableAt(result().slide, TABLE);
    const d = one(atPath(result(), TABLE), 'table-overflow');
    expect(d.data?.shownRows).toBe(shownRowsOf(t, 200));
  });

  it('the message reads as a table overflow', () => {
    const d = one(atPath(result(), TABLE), 'table-overflow');
    expect(d.message).toMatch(/Tabela estourou/);
    expect(d.message).toMatch(/de 20 linhas/);
  });

  it('an overflowing table does not produce box-overflow on its parent', () => {
    expect(byCode(result(), 'box-overflow')).toEqual([]);
    expect(byCode(result(), 'text-overflow')).toEqual([]);
  });

  it('no text-shrunk when it did not fit', () => {
    expect(byCode(result(), 'text-shrunk')).toEqual([]);
  });
});

describe('fit — table that fits after shrinking', () => {
  // 10 linhas de dados + cabeçalho = 11 linhas: cabe em 12 pt, não cabe em 13 pt.
  const height = 11 * rowHeightAt(12) + 0.25;
  const result = lazy(() =>
    fit(
      <Slide>
        <Box height={height}>
          <Table columns={COLUMNS} rows={rowsOf(10)} />
        </Box>
      </Slide>,
    ),
  );

  it('precondition: 13 pt does not fit', () => {
    expect(11 * rowHeightAt(13)).toBeGreaterThan(height + EPSILON);
  });

  it('ends at the largest size that fits', () => {
    expect(tableAt(result().slide, TABLE).fontSize).toBe(12);
  });

  it('text-shrunk (info) on the table path with fromSize/toSize', () => {
    const d = one(atPath(result(), TABLE), 'text-shrunk');
    expect(d.severity).toBe('info');
    expect(d.data).toMatchObject({ fromSize: 14, toSize: 12 });
    expect(d.message).toMatch(/Tabela reduzida de 14 pt para 12 pt/);
  });

  it('no table-overflow', () => {
    expect(byCode(result(), 'table-overflow')).toEqual([]);
  });

  it('the positioned table fits its frame', () => {
    const t = tableAt(result().slide, TABLE);
    expect(t.height).toBeLessThanOrEqual(height + EPSILON);
  });
});

describe('fit — minSize and fit policy', () => {
  it('high minSize → table-overflow at minSize', () => {
    const r = fit(boxed(200, { minSize: 13 }));
    const d = one(atPath(r, TABLE), 'table-overflow');
    expect(d.data).toMatchObject({ fromSize: 14, toSize: 13, totalRows: 20 });
    expect(d.data?.shownRows).toBeLessThan(20);
    expect(tableAt(r.slide, TABLE).fontSize).toBe(13);
  });

  it('fit="error" → table-overflow without shrinking', () => {
    const r = fit(boxed(200, { fit: 'error' }));
    const d = one(atPath(r, TABLE), 'table-overflow');
    expect(d.severity).toBe('error');
    expect(d.data?.totalRows).toBe(20);
    expect(d.data?.fromSize).toBe(14);
    expect(d.data?.toSize).toBe(14);
    expect(tableAt(r.slide, TABLE).fontSize).toBe(14);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
  });

  it('shrinking below the legible floor (explicit minSize) → text-illegible', () => {
    // 10 linhas de dados: cabe em 8 pt, não em 9 pt; minSize 6 permite descer.
    const height = 11 * rowHeightAt(8) + 0.25;
    expect(11 * rowHeightAt(9)).toBeGreaterThan(height + EPSILON);
    const r = fit(
      <Slide>
        <Box height={height}>
          <Table columns={COLUMNS} rows={rowsOf(10)} minSize={6} />
        </Box>
      </Slide>,
    );
    expect(tableAt(r.slide, TABLE).fontSize).toBe(8);
    const d = one(atPath(r, TABLE), 'text-illegible');
    expect(d.severity).toBe('warning');
    expect(d.data).toMatchObject({ fromSize: 14, toSize: 8 });
  });
});

// ───────────── escopo ─────────────

describe('fit — table shrinks with the texts of its scope', () => {
  const Panel = (props: { height: number }) => (
    <Box height={props.height}>
      <Text fontSize={20}>Resultados do trimestre</Text>
      <Table columns={COLUMNS} rows={rowsOf(10)} />
    </Box>
  );

  it('a component scope moves Text and Table by the same delta', () => {
    // d = 2: Text 18 pt + 11 linhas de tabela em 12 pt cabem; d = 1 não.
    const height = lineHeightAt(18) + 11 * rowHeightAt(12) + 0.25;
    const r = fit(
      <Slide>
        <Panel height={height} />
      </Slide>,
    );
    const text = textAt(r.slide, 'Slide > Panel > Text');
    const t = tableAt(r.slide, 'Slide > Panel > Table');
    expect(t.fontSize).toBeLessThan(14);
    expect(text.text.fontSize).toBeLessThan(20);
    expect(20 - text.text.fontSize).toBe(14 - t.fontSize);
    expect(byCode(r, 'table-overflow')).toEqual([]);
  });

  it('Table is not a component segment: a Text sibling in the same Box shrinks too', () => {
    const r = fit(
      <Slide>
        <Box height={200}>
          <Text fontSize={20}>Título</Text>
          <Table columns={COLUMNS} rows={rowsOf(20)} />
        </Box>
      </Slide>,
    );
    expect(textAt(r.slide, 'Slide > Box > Text').text.fontSize).toBeLessThan(20);
    expect(tableAt(r.slide, 'Slide > Box > Table').fontSize).toBeLessThan(14);
  });

  it('a Table directly in the slide is its own scope: a slide-level Text does not shrink', () => {
    const r = fit(
      <Slide>
        {/* shrink 0: o Yoga não espreme o título, então ele não estoura por conta própria */}
        <Text fontSize={30} flexShrink={0}>
          Título
        </Text>
        <Table columns={COLUMNS} rows={rowsOf(20)} />
      </Slide>,
    );
    expect(textAt(r.slide, 'Slide > Text').text.fontSize).toBe(30);
    expect(tableAt(r.slide, 'Slide > Table').fontSize).toBeLessThan(14);
    expect(atPath(r, 'Slide > Text')).toEqual([]);
  });
});

// ───────────── fonte ausente e palavra partida ─────────────

describe('fit — font missing in table cells', () => {
  const result = lazy(() => fit(boxed(200, { fontFamily: 'Fonte Inexistente' } as Partial<TableProps>)));

  it('only font-missing, once, on the table path', () => {
    const ds = atPath(result(), TABLE);
    expect(ds.map((d) => d.code)).toEqual(['font-missing']);
  });

  it('no table-overflow and no shrink', () => {
    expect(byCode(result(), 'table-overflow')).toEqual([]);
    expect(byCode(result(), 'text-shrunk')).toEqual([]);
    expect(tableAt(result().slide, TABLE).fontSize).toBe(14);
  });
});

describe('fit — word broken inside a narrow column', () => {
  it('persisting word break → text-word-broken citing the column', () => {
    const r = fit(
      <Slide>
        <Table
          width={300}
          columns={[{ header: 'Área', width: 40 }, { header: 'Valor' }]}
          rows={[['Supercalifragilístico', '1']]}
        />
      </Slide>,
    );
    const d = one(atPath(r, 'Slide > Table'), 'text-word-broken');
    expect(d.severity).toBe('warning');
    expect(d.message).toMatch(/na coluna "Área"/);
  });
});

// ───────────── detectOverflow ─────────────

describe('detectOverflow — table', () => {
  const props: TableProps = { columns: COLUMNS, rows: rowsOf(9) };

  const slideWith = (tableFrameHeight: number, boxHeight = 400): PositionedSlide => {
    const t = pTable(rect(0, 0, 600, tableFrameHeight), props, { path: 'Slide > Box > Table' });
    const children: readonly PositionedNode[] = [t];
    return pSlide([{ ...pBox(rect(0, 0, 600, boxHeight), {}, children) }], {}, SIZE_16X9);
  };

  it('reports kind "table" when height passes the available height', () => {
    // pTable: 10 linhas × (20 + 2 × 4) = 280 pt
    const overflows = detectOverflow(slideWith(100, 100));
    const table = overflows.filter((o) => o.kind === 'table');
    expect(table).toHaveLength(1);
    expect(table[0]?.path).toBe('Slide > Box > Table');
    expect(table[0]?.overflowPt).toBeCloseTo(180, 6);
    expect(table[0]?.overflowPct).toBeCloseTo(180, 6);
  });

  it('clips by the parent content area', () => {
    const overflows = detectOverflow(slideWith(280, 200));
    const table = overflows.find((o) => o.kind === 'table');
    expect(table?.overflowPt).toBeCloseTo(80, 6);
  });

  it('the parent box is not reported for an overflowing table', () => {
    expect(detectOverflow(slideWith(280, 200)).filter((o) => o.kind === 'box')).toEqual([]);
  });

  it('a table that fits reports nothing', () => {
    expect(detectOverflow(slideWith(280, 400))).toEqual([]);
  });
});
