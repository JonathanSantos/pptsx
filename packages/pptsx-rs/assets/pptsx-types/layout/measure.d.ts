import type { ResolvedText, TextMeasureInput } from '../core/types.ts';
/**
 * Entrada única do medidor para um Text: layout, remedição final e fit medem com os
 * mesmos runs, o mesmo nowrap e o mesmo letterSpacing, senão a altura do Yoga e as
 * linhas finais divergem.
 */
export declare const measureInputOf: (source: ResolvedText, maxWidth: number) => TextMeasureInput;
