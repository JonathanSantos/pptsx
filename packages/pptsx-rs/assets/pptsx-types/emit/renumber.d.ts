import JSZip from 'jszip';
export type ChartRenumbering = ReadonlyMap<number, number>;
/** Números dos gráficos do pacote → 1..n, em ordem crescente do número original. */
export declare const chartRenumberingOf: (names: readonly string[]) => ChartRenumbering;
/** Troca o número em todo nome de parte/alvo de gráfico ou xlsx embutido do texto. */
export declare const renumberChartRefs: (text: string, renumbering: ChartRenumbering) => string;
/** Renomeia as partes e reescreve as referências (.rels e [Content_Types].xml) no zip. */
export declare const renumberCharts: (zip: JSZip) => Promise<void>;
