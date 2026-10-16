import type { ResolvedCell, TableProps } from '../core/types.ts';
import { type ResolveEnv } from './icon.ts';
/**
 * Grade da Table (M14): cabeçalhos extras, a linha de `columns` e os dados, cada célula
 * normalizada (texto, runs, merge, estilo, ícone). Posicionamento com merges como o algoritmo
 * de tabela do HTML: cada célula vai na próxima coluna livre da linha; `rowSpan`/`colSpan`
 * ocupam as seguintes. Merge que sai da grade, se sobrepõe ou deixa a linha incompleta →
 * ResolveError (o PPTX não tem como representar).
 */
type TableResolvedProps = Omit<TableProps, 'children'>;
export interface TableGrid {
    readonly grid: readonly (readonly ResolvedCell[])[];
    readonly headerCount: number;
    /** Texto das linhas de dados (compatível com `ResolvedTable.rows`). */
    readonly rows: readonly (readonly string[])[];
}
export declare const tableGridOf: (props: TableResolvedProps, path: string, env: ResolveEnv) => TableGrid;
export {};
