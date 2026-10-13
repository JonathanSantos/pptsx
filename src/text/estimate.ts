import type { TextLayout, TextMeasureInput, TextMeasurer } from '../core/types.ts';
import { layoutLines, type MeasureWidth, widestLine } from './lines.ts';

// Proporções da estimativa (CONTRACTS §text): sem fonte real, tudo é fração do corpo.
const CHAR_WIDTH_RATIO = 0.5;
const LINE_HEIGHT_RATIO = 1.2;
const ASCENT_RATIO = 0.9;

const estimateWidth =
  (size: number): MeasureWidth =>
  (text) =>
    [...text].length * CHAR_WIDTH_RATIO * size;

const measureEstimate = (input: TextMeasureInput): TextLayout => {
  const { size, lineHeight: multiplier } = input.style;
  const measureWidth = estimateWidth(size);
  const { lines, truncated } = layoutLines(input.content, input.maxWidth, input.maxLines, measureWidth);
  const lineHeight = LINE_HEIGHT_RATIO * size * multiplier;
  return {
    lines,
    fontSize: size,
    lineHeight,
    ascent: ASCENT_RATIO * size * multiplier,
    width: widestLine(lines, measureWidth),
    height: lines.length * lineHeight,
    truncated,
    fontMissing: false,
  };
};

export const createEstimateMeasurer = (): TextMeasurer => measureEstimate;
