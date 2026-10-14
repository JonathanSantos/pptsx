import { textStyleOf } from '../core/defaults.ts';
import type { ResolvedText, TextMeasureInput } from '../core/types.ts';

/**
 * Entrada única do medidor para um Text: layout, remedição final e fit medem com os
 * mesmos runs e o mesmo nowrap, senão a altura do Yoga e as linhas finais divergem.
 */
export const measureInputOf = (source: ResolvedText, maxWidth: number): TextMeasureInput => ({
  content: source.content,
  style: textStyleOf(source.props),
  runs: source.runs,
  maxWidth,
  maxLines: source.props.maxLines,
  nowrap: source.props.nowrap,
});
