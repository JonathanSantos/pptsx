import type * as Pptx from './pptx.ts';
import type { ChartKind, ChartLabelPosition, ChartLegendPosition, ChartProps, ChartSeries, PositionedChart } from '../core/types.ts';
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
export declare const isRadial: (kind: ChartKind) => boolean;
export declare const isHorizontal: (kind: ChartKind) => boolean;
export declare const isStacked: (kind: ChartKind) => boolean;
/** Valores de todas as séries (scatter: os y dos pontos). */
export declare const seriesValuesOf: (series: ChartSeries) => readonly number[];
/** Menor número de casas decimais que representa o valor (até MAX_LABEL_DECIMALS). */
export declare const decimalsOf: (value: number) => number;
/** Casas decimais dos rótulos de valor: o maior número de casas entre os dados (o preview usa o mesmo). */
export declare const labelDecimalsOf: (props: ChartProps) => number;
/** '0', '0.0', '0.00'…: o padrão '#,##0' do pptxgenjs arredonda 38,2 para "38". */
export declare const numberFormatOf: (props: ChartProps) => string;
/**
 * Eixo de valores em 'General' (M10-H): com o formato dos rótulos o Keynote mostrava os ticks
 * como "60,0 / 45,0". 'General' mostra o tick como ele é (60, 2,5), no separador do idioma.
 * Empilhado 100 %: o eixo vai de 0 a 1, então '0%'.
 */
export declare const VALUE_AXIS_FORMAT = "General";
/** Cor da i-ésima série: a da série, a de `colors[i]` ou a paleta. */
export declare const seriesColorOf: (props: ChartProps, index: number) => string;
/** Uma cor por série ou, na pizza/anel, por fatia. */
export declare const chartColorsOf: (props: ChartProps) => string[];
/**
 * Scatter no pptxgenjs: a 1ª entrada é o eixo X, comum a todas as séries; cada série tem um y
 * por x. Séries com x diferentes: os x são unidos (ordenados) e a série fica vazia onde não tem ponto.
 */
export declare const scatterDataOf: (props: ChartProps) => Pptx.ChartSeriesData[];
export declare const chartDataOf: (props: ChartProps) => Pptx.ChartSeriesData[];
interface Labels {
    readonly show: boolean;
    readonly format?: string;
    readonly position?: ChartLabelPosition;
}
export declare const labelsOf: (props: ChartProps) => Labels;
export declare const legendPositionOf: (props: ChartProps) => ChartLegendPosition;
export declare const chartOptionsOf: (node: PositionedChart) => Pptx.ChartOptions;
interface Layer {
    readonly as: 'bar' | 'line';
    readonly secondary: boolean;
    readonly indexes: readonly number[];
}
/** Camadas na ordem: barras primárias, linhas primárias, barras secundárias, linhas secundárias. */
export declare const comboLayersOf: (props: ChartProps) => readonly Layer[];
export declare const hasSecondaryAxis: (props: ChartProps) => boolean;
export declare const chartOf: (node: PositionedChart) => ChartSpec;
export {};
