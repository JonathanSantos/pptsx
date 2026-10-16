import type * as Pptx from './pptx.ts';
import type { LineBreaks, PositionedTable } from '../core/types.ts';
/**
 * Table → `slide.addTable(rows, options)` (M10-D). Funções puras; unidades e
 * armadilhas do pptxgenjs 4.0.1 vêm do spike (docs/work/reports/M10-spike.md).
 */
export interface TableSpec {
    readonly rows: Pptx.TableRow[];
    readonly options: Pptx.TableProps;
}
/** O que da emissão importa para a tabela (EmitContext satisfaz). */
export interface TableEmitContext {
    readonly lang?: string;
    readonly lineBreaks?: LineBreaks;
}
/** Erro de emissão: a árvore é válida, mas o PPTX não consegue representá-la. */
export declare class EmitError extends Error {
    constructor(message: string);
}
/**
 * Margem sempre em polegadas: o pptxgenjs lê o array inteiro em pt quando o 1º
 * elemento é ≥ 1, então um padding de 72 pt ou mais mudaria de unidade sem aviso.
 */
export declare const cellMarginOf: (node: PositionedTable) => [number, number, number, number];
/** Linhas do pptxgenjs: cada célula que desenha, na ordem da grade (as cobertas por merge somem). */
export declare const tableRowsOf: (node: PositionedTable, ctx?: TableEmitContext) => Pptx.TableRow[];
export declare const tableOptionsOf: (node: PositionedTable, ctx?: TableEmitContext) => Pptx.TableProps;
export declare const tableOf: (node: PositionedTable, ctx?: TableEmitContext) => TableSpec;
