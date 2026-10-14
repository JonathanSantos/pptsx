import type { ChartData, ChartKind, ChartProps, ChartSeries, CssStyle, TableCellValue, TableProps } from '../core/types.ts';
import { ResolveError } from './errors.ts';

type ChartResolvedProps = Omit<ChartProps, 'children'>;
type TableResolvedProps = Omit<TableProps, 'children'>;

const CHART_KINDS: readonly ChartKind[] = ['bar', 'line', 'pie'];

const isChartKind = (kind: unknown): kind is ChartKind => (CHART_KINDS as readonly unknown[]).includes(kind);

const assertKind = (kind: unknown, path: string): void => {
  if (isChartKind(kind)) return;
  throw new ResolveError(`<Chart>: kind ${JSON.stringify(kind)} inválido; use "bar", "line" ou "pie"`, path);
};

// JS sem tipos pode mandar data sem categories/series; erro claro em vez de TypeError lá na frente.
const isChartData = (data: unknown): data is ChartData =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as ChartData).categories) &&
  Array.isArray((data as ChartData).series);

const assertDataShape = (props: ChartResolvedProps, path: string): void => {
  if (isChartData(props.data)) return;
  throw new ResolveError('<Chart> precisa de data = { categories: [...], series: [...] }', path);
};

const assertNotEmpty = (props: ChartResolvedProps, path: string): void => {
  if (props.data.categories.length === 0) throw new ResolveError('<Chart>: data.categories precisa de ao menos uma categoria', path);
  if (props.data.series.length === 0) throw new ResolveError('<Chart>: data.series precisa de ao menos uma série', path);
};

const assertSingleSeriesForPie = (props: ChartResolvedProps, path: string): void => {
  const count = props.data.series.length;
  if (props.kind !== 'pie' || count === 1) return;
  throw new ResolveError(`<Chart kind="pie"> aceita uma única série; recebeu ${count}`, path);
};

const assertSeriesLength = (series: ChartSeries, categories: readonly string[], path: string): void => {
  const count = Array.isArray(series.values) ? series.values.length : 0;
  if (count === categories.length) return;
  throw new ResolveError(
    `<Chart>: a série ${JSON.stringify(series.name)} tem ${count} valores para ${categories.length} categorias`,
    path,
  );
};

const assertFiniteValues = (series: ChartSeries, categories: readonly string[], path: string): void => {
  const index = series.values.findIndex((value) => typeof value !== 'number' || !Number.isFinite(value));
  if (index === -1) return;
  throw new ResolveError(
    `<Chart>: a série ${JSON.stringify(series.name)} tem valor não finito (${String(series.values[index])}) no índice ${index} (categoria ${JSON.stringify(categories[index])})`,
    path,
  );
};

/** Gráfico precisa de tamanho de fora: width/height, flex, absoluto ou a célula de um grid. */
const hasOwnSize = (css: CssStyle, parentCss: CssStyle | undefined): boolean =>
  css.width !== undefined ||
  css.height !== undefined ||
  css.flexGrow > 0 ||
  css.position === 'absolute' ||
  parentCss?.display === 'grid';

// Sem isso o Yoga daria 0×0 numa column sem stretch, ou só a largura: o gráfico sumiria sem aviso.
export const assertChartSize = (css: CssStyle, parentCss: CssStyle | undefined, path: string): void => {
  if (hasOwnSize(css, parentCss)) return;
  throw new ResolveError(
    '<Chart> precisa de width, height, flex/flexGrow ou de uma célula de grid: um gráfico não tem tamanho próprio',
    path,
  );
};

/** Valida os dados de um Chart (o tamanho é `assertChartSize`); lança ResolveError no primeiro problema. */
export const assertValidChart = (props: ChartResolvedProps, path: string): void => {
  assertKind(props.kind, path);
  assertDataShape(props, path);
  assertNotEmpty(props, path);
  assertSingleSeriesForPie(props, path);
  const { categories, series } = props.data;
  series.forEach((item) => assertSeriesLength(item, categories, path));
  series.forEach((item) => assertFiniteValues(item, categories, path));
};

const assertColumns = (props: TableResolvedProps, path: string): void => {
  if (Array.isArray(props.columns) && props.columns.length > 0) return;
  throw new ResolveError('<Table> precisa de ao menos uma coluna', path);
};

const assertRowsArray = (props: TableResolvedProps, path: string): void => {
  if (Array.isArray(props.rows)) return;
  throw new ResolveError('<Table>: rows tem que ser uma lista de linhas (pode ser vazia)', path);
};

// Linha numerada a partir de 1 (como o autor conta), sem contar o cabeçalho.
const assertRowWidth = (row: readonly TableCellValue[], index: number, columns: number, path: string): void => {
  const count = Array.isArray(row) ? row.length : 0;
  if (count === columns) return;
  throw new ResolveError(`<Table>: a linha ${index + 1} tem ${count} células para ${columns} colunas`, path);
};

/** Valida as props já resolvidas de uma Table; lança ResolveError no primeiro problema. */
export const assertValidTable = (props: TableResolvedProps, path: string): void => {
  assertColumns(props, path);
  assertRowsArray(props, path);
  props.rows.forEach((row, index) => assertRowWidth(row, index, props.columns.length, path));
};

/** Células como texto: o layout mede strings; `String(n)` é o que o autor veria no JS. */
export const normalizeRows = (rows: TableProps['rows']): readonly (readonly string[])[] =>
  rows.map((row) => row.map((cell) => (typeof cell === 'string' ? cell : String(cell))));
