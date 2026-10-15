import { describe, expect, it } from 'vitest';
import type {
  ChartData,
  DeckContext,
  ResolvedChart,
  ResolvedNode,
  ResolvedSlide,
  ResolvedTable,
  SizeSpec,
  SlideElement,
  TableColumn,
} from '../../src/core/types.ts';
import { jsx } from '../../src/jsx/jsx-runtime.ts';
import { Box, Chart, Deck, Slide, Table, Text } from '../../src/primitives/index.ts';
import { ResolveError, resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';

/** CONTRACTS §M10 "src/resolve/ + src/primitives/ (M10-A)": validação e normalização de Chart e Table. */

const ctxOf = (spec: SizeSpec): DeckContext => createContext(resolveSize(spec));
const CTX = ctxOf('16x9');

const resolveAt = (slide: SlideElement, ctx: DeckContext = CTX): ResolvedSlide => {
  const first = resolveDeck(<Deck>{slide}</Deck>, ctx).slides[0];
  if (!first) throw new Error('no slide');
  return first;
};

const descendants = (nodes: readonly ResolvedNode[]): ResolvedNode[] =>
  nodes.flatMap((node) => [node, ...('children' in node ? descendants(node.children) : [])]);

const firstOf = <K extends ResolvedNode['kind']>(slide: ResolvedSlide, kind: K): Extract<ResolvedNode, { kind: K }> => {
  const node = descendants(slide.children).find((n) => n.kind === kind);
  if (!node) throw new Error(`no ${kind}`);
  return node as Extract<ResolvedNode, { kind: K }>;
};

const resolveError = (slide: SlideElement): ResolveError => {
  let caught: unknown;
  try {
    resolveAt(slide);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ResolveError);
  return caught as ResolveError;
};

const CATEGORIES = ['Jan', 'Fev', 'Mar', 'Abr'];
const TWO_SERIES: ChartData = {
  categories: CATEGORIES,
  series: [
    { name: 'Receita', values: [1, 2, 3, 4] },
    { name: 'Custo', values: [4, 3, 2, 1] },
  ],
};
const COLUMNS: readonly TableColumn[] = [{ header: 'Área', width: '40%' }, { header: 'Q2' }, { header: 'Q3' }, { header: 'Δ' }];

// ───────────── Chart ─────────────

describe('resolve — Chart', () => {
  it('bar with 2 series resolves as a chart leaf', () => {
    const chart = firstOf(
      resolveAt(
        <Slide>
          <Chart kind="bar" data={TWO_SERIES} width={400} height={200} />
        </Slide>,
      ),
      'chart',
    );
    expect(chart.kind).toBe('chart');
    expect(chart.path).toBe('Slide > Chart');
    expect(chart.props.kind).toBe('bar');
    expect(chart.props.data).toEqual(TWO_SERIES);
    expect('children' in chart).toBe(false);
  });

  it('series with the wrong length → error', () => {
    const data: ChartData = { categories: CATEGORIES, series: [{ name: 'Receita', values: [1, 2, 3] }] };
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="bar" data={data} grow={1} />
        </Slide>,
      ),
    ).toThrow(/série "Receita" tem 3 valores para 4 categorias/);
  });

  it('pie with 2 series → error', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="pie" data={TWO_SERIES} grow={1} />
        </Slide>,
      ),
    ).toThrow(/<Chart kind="pie"> aceita uma única série; recebeu 2/);
  });

  it('NaN value → error naming series and index', () => {
    const data: ChartData = { categories: CATEGORIES, series: [{ name: 'Receita', values: [1, 2, Number.NaN, 4] }] };
    const error = resolveError(
      <Slide>
        <Chart kind="line" data={data} grow={1} />
      </Slide>,
    );
    expect(error.message).toMatch(/Receita/);
    expect(error.message).toMatch(/não finito/);
    expect(error.message).toMatch(/índice 2/);
  });

  it('Infinity value → error', () => {
    const data: ChartData = { categories: ['a'], series: [{ name: 's', values: [Number.POSITIVE_INFINITY] }] };
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="bar" data={data} grow={1} />
        </Slide>,
      ),
    ).toThrow(/não finito/);
  });

  it('no size and no grow → error', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="bar" data={TWO_SERIES} />
        </Slide>,
      ),
    ).toThrow(/<Chart> precisa de width, height, flex\/flexGrow ou de uma célula de grid/);
  });

  it('grow={0} counts as no size', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="bar" data={TWO_SERIES} grow={0} />
        </Slide>,
      ),
    ).toThrow(/precisa de width, height, flex\/flexGrow ou de uma célula de grid/);
  });

  it('a Chart in a grid cell counts as sized (M11)', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Box display="grid" gridTemplateColumns="1fr 1fr" height={200}>
            <Chart kind="bar" data={TWO_SERIES} />
          </Box>
        </Slide>,
      ),
    ).not.toThrow();
  });

  it('empty categories → error', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="bar" data={{ categories: [], series: [{ name: 's', values: [] }] }} grow={1} />
        </Slide>,
      ),
    ).toThrow(/categoria/);
  });

  it('empty series → error', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Chart kind="bar" data={{ categories: ['a'], series: [] }} grow={1} />
        </Slide>,
      ),
    ).toThrow(/série/);
  });

  it('invalid kind → error', () => {
    expect(() => resolveAt(<Slide>{jsx(Chart, { kind: 'radar', data: TWO_SERIES, grow: 1 } as never)}</Slide>)).toThrow(
      /kind "radar" inválido/,
    );
  });

  it.each([
    ['grow', <Chart kind="bar" data={TWO_SERIES} grow={1} />],
    ['width', <Chart kind="bar" data={TWO_SERIES} width={300} />],
    ['height', <Chart kind="bar" data={TWO_SERIES} height={200} />],
    ['percent width', <Chart kind="bar" data={TWO_SERIES} width="50%" />],
    ['absolute', <Chart kind="bar" data={TWO_SERIES} position="absolute" left={0} top={0} right={0} bottom={0} />],
  ])('accepts %s as size', (_, element) => {
    expect(firstOf(resolveAt(<Slide>{element}</Slide>), 'chart').kind).toBe('chart');
  });

  it('children → error', () => {
    const error = resolveError(
      <Slide>{jsx(Chart, { kind: 'bar', data: TWO_SERIES, grow: 1, children: <Text>x</Text> } as never)}</Slide>,
    );
    expect(error.message).toMatch(/<Chart> não aceita filhos/);
  });

  it('the error carries the chart path', () => {
    const error = resolveError(
      <Slide>
        <Box>
          <Chart kind="pie" data={TWO_SERIES} grow={1} />
        </Box>
      </Slide>,
    );
    expect(error.path).toBe('Slide > Box > Chart');
  });

  it('component name becomes the path segment', () => {
    const Revenue = () => <Chart kind="bar" data={TWO_SERIES} grow={1} />;
    const chart: ResolvedChart = firstOf(
      resolveAt(
        <Slide>
          <Revenue />
        </Slide>,
      ),
      'chart',
    );
    expect(chart.path).toBe('Slide > Revenue');
  });

  it('responsive data resolves by size', () => {
    const small: ChartData = { categories: ['a'], series: [{ name: 's', values: [1] }] };
    const slide = (
      <Slide>
        <Chart kind="bar" data={{ base: TWO_SERIES, '4x3': small }} grow={1} />
      </Slide>
    );
    expect(firstOf(resolveAt(slide, CTX), 'chart').props.data).toEqual(TWO_SERIES);
    expect(firstOf(resolveAt(slide, ctxOf('4x3')), 'chart').props.data).toEqual(small);
  });
});

// ───────────── Table ─────────────

describe('resolve — Table', () => {
  it('resolves as a table leaf with path Slide > Table', () => {
    const table = firstOf(
      resolveAt(
        <Slide>
          <Table columns={COLUMNS} rows={[['Varejo', '21,3', '32,0', '+50%']]} />
        </Slide>,
      ),
      'table',
    );
    expect(table.kind).toBe('table');
    expect(table.path).toBe('Slide > Table');
    expect(table.props.columns).toEqual(COLUMNS);
    expect('children' in table).toBe(false);
  });

  it('row with fewer cells → error (rows counted from 1, header excluded)', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Table
            columns={COLUMNS}
            rows={[
              ['a', 'b', 'c', 'd'],
              ['a', 'b', 'c', 'd'],
              ['a', 'b', 'c'],
            ]}
          />
        </Slide>,
      ),
    ).toThrow(/linha 3 tem 3 células para 4 colunas/);
  });

  it('row with more cells → error', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Table columns={COLUMNS} rows={[['a', 'b', 'c', 'd', 'e']]} />
        </Slide>,
      ),
    ).toThrow(/linha 1 tem 5 células para 4 colunas/);
  });

  it('no columns → error', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Table columns={[]} rows={[]} />
        </Slide>,
      ),
    ).toThrow(/ao menos uma coluna/);
  });

  it('rows: [] is accepted (header only)', () => {
    const table = firstOf(
      resolveAt(
        <Slide>
          <Table columns={COLUMNS} rows={[]} />
        </Slide>,
      ),
      'table',
    );
    expect(table.rows).toEqual([]);
  });

  it('numbers become strings in ResolvedTable.rows; props.rows stays as written', () => {
    const rows = [['Varejo', 21.3, 32, -0.5]] as const;
    const table: ResolvedTable = firstOf(
      resolveAt(
        <Slide>
          <Table columns={COLUMNS} rows={rows} />
        </Slide>,
      ),
      'table',
    );
    expect(table.rows).toEqual([['Varejo', '21.3', '32', '-0.5']]);
    expect(table.props.rows).toEqual([['Varejo', 21.3, 32, -0.5]]);
  });

  it('strings keep NBSP and newlines', () => {
    const table = firstOf(
      resolveAt(
        <Slide>
          <Table columns={[{ header: 'A' }]} rows={[['R$ 10\nlinha 2']]} />
        </Slide>,
      ),
      'table',
    );
    expect(table.rows).toEqual([['R$ 10\nlinha 2']]);
  });

  it('children → error', () => {
    const error = resolveError(
      <Slide>{jsx(Table, { columns: COLUMNS, rows: [], children: <Text>x</Text> } as never)}</Slide>,
    );
    expect(error.message).toMatch(/<Table> não aceita filhos/);
  });

  it('sibling tables get indexed paths', () => {
    const slide = resolveAt(
      <Slide>
        <Table columns={COLUMNS} rows={[]} />
        <Table columns={COLUMNS} rows={[]} />
      </Slide>,
    );
    expect(slide.children.map((c) => c.path)).toEqual(['Slide > Table[0]', 'Slide > Table[1]']);
  });

  it('responsive rows resolve by size', () => {
    const many = [
      ['a', '1', '2', '3'],
      ['b', '1', '2', '3'],
    ];
    const few = [['a', '1', '2', '3']];
    const slide = (
      <Slide>
        <Table columns={COLUMNS} rows={{ base: few, tall: many }} />
      </Slide>
    );
    expect(firstOf(resolveAt(slide, CTX), 'table').rows).toEqual(few);
    expect(firstOf(resolveAt(slide, ctxOf('4x3')), 'table').rows).toEqual(many);
  });

  it('responsive size resolves to a concrete number', () => {
    const slide = (
      <Slide>
        <Table columns={COLUMNS} rows={[]} size={{ base: 14, wide: 18 }} />
      </Slide>
    );
    expect(firstOf(resolveAt(slide, CTX), 'table').props.size).toBe(14);
    expect(firstOf(resolveAt(slide, ctxOf('wide')), 'table').props.size).toBe(18);
  });
});
