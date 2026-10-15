import type { ChartData, ChartKind, ChartProps, ChartSeries, CssStyle, TableCellValue, TableProps } from '../core/types.ts';
import { ResolveError } from './errors.ts';

type ChartResolvedProps = Omit<ChartProps, 'children'>;
type TableResolvedProps = Omit<TableProps, 'children'>;

const CHART_KINDS: readonly ChartKind[] = [
  'bar',
  'barH',
  'stackedBar',
  'stackedBarH',
  'stackedBar100',
  'line',
  'area',
  'stackedArea',
  'pie',
  'doughnut',
  'scatter',
  'combo',
];

/** Kinds que o emissor e o preview já desenham (o M14-2 libera os demais). */
const READY_KINDS: readonly ChartKind[] = CHART_KINDS;

const quoted = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');

const isChartKind = (kind: unknown): kind is ChartKind => (CHART_KINDS as readonly unknown[]).includes(kind);

const assertKind = (kind: unknown, path: string): void => {
  if (!isChartKind(kind)) throw new ResolveError(`<Chart>: kind ${JSON.stringify(kind)} inválido; use ${quoted(CHART_KINDS)}`, path);
  if (!READY_KINDS.includes(kind)) throw new ResolveError(`<Chart kind="${kind}"> ainda não está disponível`, path);
};

/** Pizza e anel: uma série, uma fatia por categoria. */
const isRadial = (kind: ChartKind): boolean => kind === 'pie' || kind === 'doughnut';

// JS sem tipos pode mandar data sem categories/series; erro claro em vez de TypeError lá na frente.
const isChartData = (data: unknown, kind: ChartKind): data is ChartData =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as ChartData).series) &&
  (kind === 'scatter' || Array.isArray((data as ChartData).categories));

const assertDataShape = (props: ChartResolvedProps, path: string): void => {
  if (isChartData(props.data, props.kind)) return;
  const shape = props.kind === 'scatter' ? '{ series: [{ name, points: [[x, y], …] }] }' : '{ categories: [...], series: [...] }';
  throw new ResolveError(`<Chart> precisa de data = ${shape}`, path);
};

const assertNotEmpty = (props: ChartResolvedProps, path: string): void => {
  if (props.kind !== 'scatter' && (props.data.categories ?? []).length === 0) {
    throw new ResolveError('<Chart>: data.categories precisa de ao menos uma categoria', path);
  }
  if (props.data.series.length === 0) throw new ResolveError('<Chart>: data.series precisa de ao menos uma série', path);
};

const assertSingleSeriesForRadial = (props: ChartResolvedProps, path: string): void => {
  const count = props.data.series.length;
  if (!isRadial(props.kind) || count === 1) return;
  throw new ResolveError(`<Chart kind="${props.kind}"> aceita uma única série; recebeu ${count}`, path);
};

const assertSeriesLength = (series: ChartSeries, categories: readonly string[], path: string): void => {
  const count = Array.isArray(series.values) ? series.values.length : 0;
  if (count === categories.length) return;
  throw new ResolveError(
    `<Chart>: a série ${JSON.stringify(series.name)} tem ${count} valores para ${categories.length} categorias`,
    path,
  );
};

const isFiniteNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);

const assertFiniteValues = (series: ChartSeries, categories: readonly string[], path: string): void => {
  const values = series.values ?? [];
  const index = values.findIndex((value) => !isFiniteNumber(value));
  if (index === -1) return;
  throw new ResolveError(
    `<Chart>: a série ${JSON.stringify(series.name)} tem valor não finito (${String(values[index])}) no índice ${index} (categoria ${JSON.stringify(categories[index])})`,
    path,
  );
};

/** Scatter: cada série com ao menos um par [x, y] de números finitos. */
const assertPoints = (series: ChartSeries, path: string): void => {
  const points = series.points;
  if (!Array.isArray(points) || points.length === 0) {
    throw new ResolveError(`<Chart kind="scatter">: a série ${JSON.stringify(series.name)} precisa de points: [[x, y], …]`, path);
  }
  const bad = points.findIndex((point) => !Array.isArray(point) || point.length !== 2 || !point.every(isFiniteNumber));
  if (bad === -1) return;
  throw new ResolveError(`<Chart kind="scatter">: a série ${JSON.stringify(series.name)} tem um ponto inválido no índice ${bad} (use [x, y] com números)`, path);
};

/** Combo: toda série diz como é desenhada; `axis` só 'primary' | 'secondary'. */
const assertComboSeries = (series: ChartSeries, path: string): void => {
  if (series.as !== 'bar' && series.as !== 'line') {
    throw new ResolveError(`<Chart kind="combo">: a série ${JSON.stringify(series.name)} precisa de as: "bar" ou "line"`, path);
  }
  if (series.axis !== undefined && series.axis !== 'primary' && series.axis !== 'secondary') {
    throw new ResolveError(`<Chart kind="combo">: axis ${JSON.stringify(series.axis)} inválido na série ${JSON.stringify(series.name)}; use "primary" ou "secondary"`, path);
  }
};

const assertHoleSize = (props: ChartResolvedProps, path: string): void => {
  const hole = props.holeSize;
  if (hole === undefined || (isFiniteNumber(hole) && hole >= 10 && hole <= 90)) return;
  throw new ResolveError(`<Chart>: holeSize ${JSON.stringify(hole)} inválido; use um número de 10 a 90 (% do diâmetro)`, path);
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
  assertSingleSeriesForRadial(props, path);
  assertHoleSize(props, path);
  const { series } = props.data;
  if (props.kind === 'scatter') {
    series.forEach((item) => assertPoints(item, path));
    return;
  }
  const categories = props.data.categories ?? [];
  if (props.kind === 'combo') series.forEach((item) => assertComboSeries(item, path));
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
const assertRowArray = (row: readonly TableCellValue[], index: number, path: string): void => {
  if (Array.isArray(row)) return;
  throw new ResolveError(`<Table>: a linha ${index + 1} tem 0 células: cada linha é uma lista de células`, path);
};

/** Valida as props já resolvidas de uma Table; a largura de cada linha (com merges) é do table-grid. */
export const assertValidTable = (props: TableResolvedProps, path: string): void => {
  assertColumns(props, path);
  assertRowsArray(props, path);
  props.rows.forEach((row, index) => assertRowArray(row, index, path));
};

