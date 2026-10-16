import type { ChartProps, CssStyle, TableProps } from '../core/types.ts';
type ChartResolvedProps = Omit<ChartProps, 'children'>;
type TableResolvedProps = Omit<TableProps, 'children'>;
export declare const assertChartSize: (css: CssStyle, parentCss: CssStyle | undefined, path: string) => void;
/** Valida os dados de um Chart (o tamanho é `assertChartSize`); lança ResolveError no primeiro problema. */
export declare const assertValidChart: (props: ChartResolvedProps, path: string) => void;
/** Valida as props já resolvidas de uma Table; a largura de cada linha (com merges) é do table-grid. */
export declare const assertValidTable: (props: TableResolvedProps, path: string) => void;
export {};
