import type * as Pptx from './pptx.ts';
import { DEFAULTS, chartColorOf, chartLabelStyleOf, chartLegendOf } from '../core/defaults.ts';
import type { ChartKind, ChartProps, PositionedChart } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { hexOf } from './runs.ts';

/**
 * Chart → `slide.addChart(type, data, options)` (M10-D). Funções puras; cada opção
 * explícita porque os padrões do pptxgenjs 4.0.1 não valem (ver M10-spike §8).
 */

export interface ChartSpec {
  readonly type: Pptx.ChartName;
  readonly data: Pptx.ChartSeriesData[];
  readonly options: Pptx.ChartOptions;
}

/** Mesmos valores de `pptx.ChartType`; aqui como literais para não depender da instância. */
const CHART_TYPES: Readonly<Record<ChartKind, Pptx.ChartName>> = { bar: 'bar', line: 'line', pie: 'pie' };

/** O título usa labelSize + 2, como no preview (src/preview/chart.ts). */
const TITLE_SIZE_DELTA = 2;
/** Grade de valores clara e fina, para não competir com as séries. */
const VALUE_GRID_LINE: Pptx.ChartOptions['valGridLine'] = { color: 'DDDDDD', size: 0.5 };
/** Teto de casas decimais do rótulo: acima disso é ruído de ponto flutuante. */
const MAX_LABEL_DECIMALS = 6;
const DECIMALS_TOLERANCE = 1e-12;

const DATA_LABEL_POSITIONS: Readonly<Record<ChartKind, Pptx.ChartOptions['dataLabelPosition']>> = {
  bar: 'outEnd',
  line: 't',
  pie: 'bestFit',
};

const range = (count: number): readonly number[] => Array.from({ length: count }, (_, index) => index);

/** Menor número de casas decimais que representa o valor (até MAX_LABEL_DECIMALS). */
export const decimalsOf = (value: number): number =>
  range(MAX_LABEL_DECIMALS + 1).find(
    (digits) => Math.abs(Number(value.toFixed(digits)) - value) <= Math.abs(value) * DECIMALS_TOLERANCE,
  ) ?? MAX_LABEL_DECIMALS;

/** '0', '0.0', '0.00'…: o padrão '#,##0' do pptxgenjs arredonda 38,2 para "38". */
export const numberFormatOf = (props: ChartProps): string => {
  const values = props.data.series.flatMap((series) => series.values);
  const digits = Math.max(0, ...values.map(decimalsOf));
  return digits === 0 ? '0' : `0.${'0'.repeat(digits)}`;
};

/** Uma cor por série (bar/line) ou por fatia (pie): com menos cores, a pizza sorteia as que faltam. */
export const chartColorsOf = (props: ChartProps): string[] => {
  const count = props.kind === 'pie' ? props.data.categories.length : props.data.series.length;
  return range(count).map((index) => hexOf(chartColorOf(props, index)));
};

export const chartDataOf = (props: ChartProps): Pptx.ChartSeriesData[] =>
  props.data.series.map((series) => ({ name: series.name, labels: [...props.data.categories], values: [...series.values] }));

const axisGridOptions: Pptx.ChartOptions = { valGridLine: VALUE_GRID_LINE, catGridLine: { style: 'none' } };

const KIND_OPTIONS: Readonly<Record<ChartKind, Pptx.ChartOptions>> = {
  bar: { barDir: 'col', barGapWidthPct: DEFAULTS.chart.barGapWidthPct, ...axisGridOptions },
  line: { lineSize: DEFAULTS.chart.lineSize, lineDataSymbol: 'none', ...axisGridOptions },
  pie: { showPercent: false, showLabel: false, dataNoEffects: true },
};

const chartAreaOf = (color: string): Pptx.ChartOptions['chartArea'] => ({
  roundedCorners: false,
  ...(DEFAULTS.chart.borderWidth > 0 ? { border: { type: 'solid', pt: DEFAULTS.chart.borderWidth, color } } : {}),
});

const titleOptionsOf = (props: ChartProps, face: string, size: number, color: string): Pptx.ChartOptions => {
  if (props.title === undefined) return { showTitle: false };
  return { showTitle: true, title: props.title, titleFontFace: face, titleFontSize: size + TITLE_SIZE_DELTA, titleColor: color };
};

export const chartOptionsOf = (node: PositionedChart): Pptx.ChartOptions => {
  const { props, frame } = node;
  const label = chartLabelStyleOf(props);
  const face = label.family;
  const size = label.size;
  const color = hexOf(label.color);
  const format = numberFormatOf(props);
  return {
    // O frame inteiro: o renderizador decide a área de plotagem dentro dele.
    x: ptToInches(frame.x),
    y: ptToInches(frame.y),
    w: ptToInches(frame.width),
    h: ptToInches(frame.height),
    chartColors: chartColorsOf(props),
    chartArea: chartAreaOf(color),
    showLegend: chartLegendOf(props),
    legendPos: 'b',
    legendFontFace: face,
    legendFontSize: size,
    legendColor: color,
    showValue: props.showValues === true,
    dataLabelFontFace: face,
    dataLabelFontSize: size,
    dataLabelColor: color,
    dataLabelPosition: DATA_LABEL_POSITIONS[props.kind],
    dataLabelFormatCode: format,
    catAxisLabelFontFace: face,
    catAxisLabelFontSize: size,
    catAxisLabelColor: color,
    valAxisLabelFontFace: face,
    valAxisLabelFontSize: size,
    valAxisLabelColor: color,
    valAxisLabelFormatCode: format,
    ...titleOptionsOf(props, face, size, color),
    ...KIND_OPTIONS[props.kind],
  };
};

export const chartOf = (node: PositionedChart): ChartSpec => ({
  type: CHART_TYPES[node.props.kind],
  data: chartDataOf(node.props),
  options: chartOptionsOf(node),
});
