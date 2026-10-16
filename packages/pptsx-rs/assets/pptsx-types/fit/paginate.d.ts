import type { ResolvedTable } from '../core/types.ts';
import type { FitInput, FitResult } from './fit.ts';
/**
 * Cortes válidos depois de k linhas de dados: nenhum rowSpan que começa antes de k termina depois.
 * `cuts[k]` = true quando dá para cortar ali.
 */
export declare const tableCutsOf: (table: ResolvedTable) => readonly boolean[];
/**
 * Ajuste de um slide do autor, que pode virar várias partes. Sem nó paginate é o
 * `fitSlide` de sempre; com ele (Box: itens; Text: linhas), uma parte só quando tudo cabe (ou nada cabe).
 */
export declare const paginateSlide: (input: FitInput) => readonly FitResult[];
