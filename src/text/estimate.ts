import type { TextLayout, TextMeasureInput, TextMeasurer } from '../core/types.ts';
import { type MeasureWidth, truncateLines, widestLine, wrapText } from './lines.ts';

// Proporções da estimativa (CONTRACTS §text): sem fonte real, tudo é fração do corpo.
const CHAR_WIDTH_RATIO = 0.5;
const LINE_HEIGHT_RATIO = 1.2;
const ASCENT_RATIO = 0.9;

const estimateWidth =
  (size: number): MeasureWidth =>
  (text) =>
    [...text].length * CHAR_WIDTH_RATIO * size;

const linesOf = ({ content, maxWidth, maxLines }: TextMeasureInput, measureWidth: MeasureWidth) => {
  const lines = wrapText(content, maxWidth, measureWidth);
  if (maxLines === undefined) return { lines, truncated: false };
  return truncateLines(lines, maxLines, maxWidth, measureWidth);
};

const measureEstimate = (input: TextMeasureInput): TextLayout => {
  const { size, lineHeight: multiplier } = input.style;
  const measureWidth = estimateWidth(size);
  const { lines, truncated } = linesOf(input, measureWidth);
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
