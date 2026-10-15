import type * as Pptx from './pptx.ts';
import { DEFAULTS, chartColorOf, chartLabelStyleOf, chartLegendOf } from '../core/defaults.ts';
import type { ChartAxis, ChartKind, ChartLabelPosition, ChartLegendPosition, ChartProps, ChartSeries, PositionedChart } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { hexOf } from './runs.ts';

/**
 * Chart → `slide.addChart(type, data, options)` (M10-D, M14-2). Funções puras; cada opção
 * explícita porque os padrões do pptxgenjs 4.0.1 não valem (ver M10-spike §8). O combo é uma
 * lista de camadas (`IChartMulti`), uma por (desenho, eixo), com o eixo secundário à direita.
 */

export interface ChartSpec {
  readonly type: Pptx.ChartName | Pptx.ChartMulti[];
  readonly data: Pptx.ChartSeriesData[];
  readonly options: Pptx.ChartOptions;
}

/** Família de desenho de cada kind (o `type` do pptxgenjs). */
const CHART_TYPES: Readonly<Record<Exclude<ChartKind, 'combo'>, Pptx.ChartName>> = {
  bar: 'bar',
  barH: 'bar',
  stackedBar: 'bar',
  stackedBarH: 'bar',
  stackedBar100: 'bar',
  line: 'line',
  area: 'area',
  stackedArea: 'area',
  pie: 'pie',
  doughnut: 'doughnut',
  scatter: 'scatter',
};

/** O título usa labelSize + 2, como no preview (src/preview/chart.ts). */
const TITLE_SIZE_DELTA = 2;
/** Grade de valores clara e fina, para não competir com as séries. */
const VALUE_GRID_LINE: Pptx.ChartOptions['valGridLine'] = { color: 'DDDDDD', size: 0.5 };
const NO_GRID: Pptx.ChartOptions['valGridLine'] = { style: 'none' };
/** Teto de casas decimais do rótulo: acima disso é ruído de ponto flutuante. */
const MAX_LABEL_DECIMALS = 6;
const DECIMALS_TOLERANCE = 1e-12;

const range = (count: number): readonly number[] => Array.from({ length: count }, (_, index) => index);

export const isRadial = (kind: ChartKind): boolean => kind === 'pie' || kind === 'doughnut';
export const isHorizontal = (kind: ChartKind): boolean => kind === 'barH' || kind === 'stackedBarH';
export const isStacked = (kind: ChartKind): boolean =>
  kind === 'stackedBar' || kind === 'stackedBarH' || kind === 'stackedBar100' || kind === 'stackedArea';

/** Valores de todas as séries (scatter: os y dos pontos). */
export const seriesValuesOf = (series: ChartSeries): readonly number[] => series.values ?? (series.points ?? []).map(([, y]) => y);

/** Menor número de casas decimais que representa o valor (até MAX_LABEL_DECIMALS). */
export const decimalsOf = (value: number): number =>
  range(MAX_LABEL_DECIMALS + 1).find(
    (digits) => Math.abs(Number(value.toFixed(digits)) - value) <= Math.abs(value) * DECIMALS_TOLERANCE,
  ) ?? MAX_LABEL_DECIMALS;

/** Casas decimais dos rótulos de valor: o maior número de casas entre os dados (o preview usa o mesmo). */
export const labelDecimalsOf = (props: ChartProps): number => {
  const values = props.data.series.flatMap(seriesValuesOf);
  return Math.max(0, ...values.map(decimalsOf));
};

/** '0', '0.0', '0.00'…: o padrão '#,##0' do pptxgenjs arredonda 38,2 para "38". */
export const numberFormatOf = (props: ChartProps): string => {
  const digits = labelDecimalsOf(props);
  return digits === 0 ? '0' : `0.${'0'.repeat(digits)}`;
};

/**
 * Eixo de valores em 'General' (M10-H): com o formato dos rótulos o Keynote mostrava os ticks
 * como "60,0 / 45,0". 'General' mostra o tick como ele é (60, 2,5), no separador do idioma.
 * Empilhado 100 %: o eixo vai de 0 a 1, então '0%'.
 */
export const VALUE_AXIS_FORMAT = 'General';
const PERCENT_AXIS_FORMAT = '0%';

/** Cor da i-ésima série: a da série, a de `colors[i]` ou a paleta. */
export const seriesColorOf = (props: ChartProps, index: number): string => props.data.series[index]?.color ?? chartColorOf(props, index);

/** Uma cor por série ou, na pizza/anel, por fatia. */
export const chartColorsOf = (props: ChartProps): string[] => {
  const radial = isRadial(props.kind);
  const count = radial ? (props.data.categories ?? []).length : props.data.series.length;
  return range(count).map((index) => hexOf(radial ? chartColorOf(props, index) : seriesColorOf(props, index)));
};

const seriesDataOf = (props: ChartProps, series: readonly ChartSeries[]): Pptx.ChartSeriesData[] =>
  series.map((item) => ({ name: item.name, labels: [...(props.data.categories ?? [])], values: [...(item.values ?? [])] }));

/**
 * Scatter no pptxgenjs: a 1ª entrada é o eixo X, comum a todas as séries; cada série tem um y
 * por x. Séries com x diferentes: os x são unidos (ordenados) e a série fica vazia onde não tem ponto.
 */
export const scatterDataOf = (props: ChartProps): Pptx.ChartSeriesData[] => {
  const xs = [...new Set(props.data.series.flatMap((series) => (series.points ?? []).map(([x]) => x)))].sort((a, b) => a - b);
  const ys = props.data.series.map((series) => {
    const byX = new Map((series.points ?? []).map(([x, y]) => [x, y] as const));
    return { name: series.name, values: xs.map((x) => byX.get(x) ?? null) as number[] };
  });
  return [{ name: 'X', values: xs }, ...ys];
};

export const chartDataOf = (props: ChartProps): Pptx.ChartSeriesData[] =>
  props.kind === 'scatter' ? scatterDataOf(props) : seriesDataOf(props, props.data.series);

// ───────────── eixos ─────────────

interface TextOptions {
  readonly face: string;
  readonly size: number;
  readonly color: string;
}

const valueAxisOf = (axis: ChartAxis | undefined, text: TextOptions, percent: boolean): Pptx.ChartOptions => ({
  valAxisLabelFontFace: text.face,
  valAxisLabelFontSize: text.size,
  valAxisLabelColor: text.color,
  valAxisLabelFormatCode: axis?.format ?? (percent ? PERCENT_AXIS_FORMAT : VALUE_AXIS_FORMAT),
  valGridLine: axis?.grid === false ? NO_GRID : VALUE_GRID_LINE,
  ...(axis?.min === undefined ? {} : { valAxisMinVal: axis.min }),
  ...(axis?.max === undefined ? {} : { valAxisMaxVal: axis.max }),
  ...(axis?.step === undefined ? {} : { valAxisMajorUnit: axis.step }),
  ...(axis?.hidden === true ? { valAxisHidden: true } : {}),
  ...(axis?.title === undefined
    ? {}
    : { showValAxisTitle: true, valAxisTitle: axis.title, valAxisTitleFontFace: text.face, valAxisTitleFontSize: text.size, valAxisTitleColor: text.color }),
});

const categoryAxisOf = (axis: ChartAxis | undefined, text: TextOptions): Pptx.ChartOptions => ({
  catAxisLabelFontFace: text.face,
  catAxisLabelFontSize: text.size,
  catAxisLabelColor: text.color,
  catGridLine: axis?.grid === true ? VALUE_GRID_LINE : NO_GRID,
  ...(axis?.format === undefined ? {} : { catAxisLabelFormatCode: axis.format }),
  ...(axis?.min === undefined ? {} : { catAxisMinVal: axis.min }),
  ...(axis?.max === undefined ? {} : { catAxisMaxVal: axis.max }),
  ...(axis?.step === undefined ? {} : { catAxisMajorUnit: axis.step }),
  ...(axis?.hidden === true ? { catAxisHidden: true } : {}),
  ...(axis?.title === undefined
    ? {}
    : { showCatAxisTitle: true, catAxisTitle: axis.title, catAxisTitleFontFace: text.face, catAxisTitleFontSize: text.size, catAxisTitleColor: text.color }),
});

// ───────────── rótulos e legenda ─────────────

type DataLabelPosition = Pptx.ChartOptions['dataLabelPosition'];

/** Posições válidas por família (o OOXML recusa outEnd em barra empilhada, e área/anel não têm posição). */
const labelPositionOf = (kind: ChartKind, position: ChartLabelPosition | undefined): DataLabelPosition | undefined => {
  if (kind === 'area' || kind === 'stackedArea' || kind === 'doughnut') return undefined;
  if (isStacked(kind)) return position === 'inside' ? 'inEnd' : 'ctr';
  const outside: Readonly<Record<string, DataLabelPosition>> = { line: 't', scatter: 't', pie: 'bestFit', combo: 'outEnd' };
  if (position === 'center') return 'ctr';
  if (position === 'inside') return kind === 'line' || kind === 'scatter' ? 'b' : 'inEnd';
  return outside[kind] ?? 'outEnd';
};

interface Labels {
  readonly show: boolean;
  readonly format?: string;
  readonly position?: ChartLabelPosition;
}

export const labelsOf = (props: ChartProps): Labels => {
  if (props.labels === undefined) return { show: false };
  if (typeof props.labels === 'boolean') return { show: props.labels };
  return { show: true, ...props.labels };
};

const LEGEND_POSITIONS: Readonly<Record<ChartLegendPosition, Pptx.ChartOptions['legendPos']>> = { bottom: 'b', top: 't', left: 'l', right: 'r' };

export const legendPositionOf = (props: ChartProps): ChartLegendPosition =>
  typeof props.legend === 'object' ? props.legend.position : 'bottom';

// ───────────── opções por família ─────────────

const markersOf = (props: ChartProps, fallback: boolean): Pptx.ChartOptions =>
  (props.markers ?? fallback) ? { lineDataSymbol: 'circle', lineDataSymbolSize: DEFAULTS.chart.markerSize } : { lineDataSymbol: 'none' };

const barGroupingOf = (kind: ChartKind): string => {
  if (kind === 'stackedBar100') return 'percentStacked';
  return isStacked(kind) ? 'stacked' : 'clustered';
};

const kindOptionsOf = (props: ChartProps): Pptx.ChartOptions => {
  const { kind } = props;
  if (kind === 'pie') return { showPercent: false, showLabel: false, dataNoEffects: true };
  if (kind === 'doughnut') return { showPercent: false, showLabel: false, dataNoEffects: true, holeSize: props.holeSize ?? DEFAULTS.chart.holeSize };
  if (kind === 'line') return { lineSize: DEFAULTS.chart.lineSize, lineSmooth: props.smooth === true, ...markersOf(props, false) };
  if (kind === 'area' || kind === 'stackedArea') {
    return { barGrouping: kind === 'stackedArea' ? 'stacked' : 'standard', chartColorsOpacity: DEFAULTS.chart.areaOpacity * 100 };
  }
  // Scatter: só os pontos (sem linha ligando), como um gráfico de dispersão.
  if (kind === 'scatter') return { lineSize: 0, ...markersOf(props, true) };
  return {
    barDir: isHorizontal(kind) ? 'bar' : 'col',
    barGrouping: barGroupingOf(kind),
    barGapWidthPct: DEFAULTS.chart.barGapWidthPct,
    // Empilhada: as séries se sobrepõem 100 % (uma em cima da outra, não lado a lado).
    ...(isStacked(kind) ? { barOverlapPct: 100 } : {}),
  };
};

const chartAreaOf = (color: string): Pptx.ChartOptions['chartArea'] => ({
  roundedCorners: false,
  ...(DEFAULTS.chart.borderWidth > 0 ? { border: { type: 'solid', pt: DEFAULTS.chart.borderWidth, color } } : {}),
});

const titleOptionsOf = (props: ChartProps, text: TextOptions): Pptx.ChartOptions => {
  if (props.title === undefined) return { showTitle: false };
  return { showTitle: true, title: props.title, titleFontFace: text.face, titleFontSize: text.size + TITLE_SIZE_DELTA, titleColor: text.color };
};

const textOf = (props: ChartProps): TextOptions => {
  const label = chartLabelStyleOf(props);
  return { face: label.family, size: label.size, color: hexOf(label.color) };
};

/** Opções comuns (posição, legenda, título, rótulos, eixos) a um kind simples e ao combo. */
const baseOptionsOf = (node: PositionedChart): Pptx.ChartOptions => {
  const { props, frame } = node;
  const text = textOf(props);
  const labels = labelsOf(props);
  const position = labelPositionOf(props.kind, labels.position);
  const axes = isRadial(props.kind)
    ? {}
    : {
        ...categoryAxisOf(props.xAxis, text),
        ...valueAxisOf(props.yAxis, text, props.kind === 'stackedBar100'),
      };
  return {
    // O frame inteiro: o renderizador decide a área de plotagem dentro dele.
    x: ptToInches(frame.x),
    y: ptToInches(frame.y),
    w: ptToInches(frame.width),
    h: ptToInches(frame.height),
    chartArea: chartAreaOf(text.color),
    showLegend: chartLegendOf(props),
    legendPos: LEGEND_POSITIONS[legendPositionOf(props)],
    legendFontFace: text.face,
    legendFontSize: text.size,
    legendColor: text.color,
    showValue: labels.show,
    dataLabelFontFace: text.face,
    dataLabelFontSize: text.size,
    dataLabelColor: text.color,
    ...(position === undefined ? {} : { dataLabelPosition: position }),
    dataLabelFormatCode: labels.format ?? numberFormatOf(props),
    ...axes,
    ...titleOptionsOf(props, text),
  };
};

export const chartOptionsOf = (node: PositionedChart): Pptx.ChartOptions => ({
  ...baseOptionsOf(node),
  chartColors: chartColorsOf(node.props),
  ...kindOptionsOf(node.props),
});

// ───────────── combo ─────────────

interface Layer {
  readonly as: 'bar' | 'line';
  readonly secondary: boolean;
  readonly indexes: readonly number[];
}

/** Camadas na ordem: barras primárias, linhas primárias, barras secundárias, linhas secundárias. */
export const comboLayersOf = (props: ChartProps): readonly Layer[] => {
  const keys = [
    { as: 'bar', secondary: false },
    { as: 'line', secondary: false },
    { as: 'bar', secondary: true },
    { as: 'line', secondary: true },
  ] as const;
  return keys
    .map((key) => ({
      ...key,
      indexes: props.data.series.flatMap((series, index) => (series.as === key.as && (series.axis === 'secondary') === key.secondary ? [index] : [])),
    }))
    .filter((layer) => layer.indexes.length > 0);
};

export const hasSecondaryAxis = (props: ChartProps): boolean => props.data.series.some((series) => series.axis === 'secondary');

const layerOf = (node: PositionedChart, layer: Layer): Pptx.ChartMulti => {
  const { props } = node;
  const series = layer.indexes.map((index) => props.data.series[index]!);
  const colors = layer.indexes.map((index) => hexOf(seriesColorOf(props, index)));
  const drawing =
    layer.as === 'bar'
      ? { barDir: 'col' as const, barGrouping: 'clustered', barGapWidthPct: DEFAULTS.chart.barGapWidthPct }
      : { lineSize: DEFAULTS.chart.lineSize, lineSmooth: props.smooth === true, ...markersOf(props, false) };
  return {
    type: layer.as,
    data: seriesDataOf(props, series),
    options: { chartColors: colors, ...drawing, ...(layer.secondary ? { secondaryValAxis: true, secondaryCatAxis: true } : {}) },
  };
};

/** Eixos do combo: com secundário, um par (categoria, valor) por lado; o de categorias da direita fica oculto. */
const comboAxesOf = (props: ChartProps, text: TextOptions): Pptx.ChartOptions => {
  if (!hasSecondaryAxis(props)) return {};
  return {
    catAxes: [categoryAxisOf(props.xAxis, text), { catAxisHidden: true }],
    // O eixo da direita herda as opções do gráfico (inclusive o título do esquerdo): sem título próprio, desliga.
    valAxes: [valueAxisOf(props.yAxis, text, false), { showValAxisTitle: false, ...valueAxisOf(props.y2Axis, text, false), valGridLine: NO_GRID }],
  };
};

const comboOf = (node: PositionedChart): ChartSpec => {
  const layers = comboLayersOf(node.props);
  return {
    type: layers.map((layer) => layerOf(node, layer)),
    data: [],
    options: { ...baseOptionsOf(node), ...comboAxesOf(node.props, textOf(node.props)) },
  };
};

export const chartOf = (node: PositionedChart): ChartSpec => {
  if (node.props.kind === 'combo') return comboOf(node);
  return { type: CHART_TYPES[node.props.kind], data: chartDataOf(node.props), options: chartOptionsOf(node) };
};
