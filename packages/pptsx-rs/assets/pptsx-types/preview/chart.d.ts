import type { PositionedChart } from '../core/types.ts';
import { type TextSvgOptions } from './svg.ts';
interface Scale {
    readonly min: number;
    readonly max: number;
    readonly step: number;
}
/** Opções do chartSvg: as do texto + o idioma dos números (separador decimal, como no PPTX). */
export interface ChartSvgOptions extends TextSvgOptions {
    /** Padrão DEFAULTS.lang. */
    readonly lang?: string;
}
/**
 * Número como o PPTX mostra: `fixed` casas (rótulos de valor, formato '0.0' do emissor) ou
 * até `decimals` casas (eixo, formato 'General'), no separador decimal do idioma e sem
 * separador de milhar (nenhum dos dois formatos agrupa).
 */
export declare const formatValue: (value: number, decimals: number, lang?: string, fixed?: boolean) => string;
/**
 * Eixo de 0 (ou do mínimo negativo) ao máximo "bonito": o menor passo 1/2/5 × 10^n que
 * cobre os dados em até MAX_AXIS_INTERVALS intervalos.
 */
export declare const niceScaleOf: (values: readonly number[]) => Scale;
export declare const chartSvg: (node: PositionedChart, options?: ChartSvgOptions) => string;
export {};
