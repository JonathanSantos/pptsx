import type { PositionedTable, Rect } from '../core/types.ts';
import { type TextSvgOptions } from './svg.ts';
/** M14: fundos por célula, bordas, texto por trecho (o mesmo desenho do Text) e ícones. */
export declare const tableSvg: (node: PositionedTable, options?: TextSvgOptions, clipId?: string) => string;
/**
 * Debug: faixa da tabela abaixo do frame quando a altura pedida passa dele (mesma tolerância
 * do fit). Célula com fonte ausente tem medição estimada: o fit só reporta font-missing.
 */
export declare const tableOverflowRectOf: (node: PositionedTable) => Rect | undefined;
