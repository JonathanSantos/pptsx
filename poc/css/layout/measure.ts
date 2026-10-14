import { textStyleOf } from '../../../src/core/defaults.ts';
import type { ResolvedText, TextMeasureInput } from '../types.ts';

/**
 * Entrada única do medidor para um Text (layout, remedição final e fit medem igual).
 * Igual à da engine, mais o letterSpacing herdado.
 */
export const measureInputOf = (source: ResolvedText, maxWidth: number): TextMeasureInput => ({
  content: source.content,
  style: textStyleOf(source.props),
  runs: source.runs,
  maxWidth,
  maxLines: source.props.maxLines,
  nowrap: source.props.nowrap,
  letterSpacing: source.css.letterSpacing,
});
