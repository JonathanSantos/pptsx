import type { TextLayout, TextMeasureInput, TextMeasurer } from '../core/types.ts';
import { brokenWordsOf } from './broken.ts';
import { layoutText } from './lines.ts';
import type { MeasureRun } from './pieces.ts';

// Proporções da estimativa (CONTRACTS §text): sem fonte real, tudo é fração do corpo.
const CHAR_WIDTH_RATIO = 0.5;
const LINE_HEIGHT_RATIO = 1.2;
const ASCENT_RATIO = 0.9;

// Sem métricas não há diferença entre faces: bold e itálico medem como a regular, NBSP como espaço.
const estimateWidth =
  (size: number): MeasureRun =>
  (text) =>
    [...text].length * CHAR_WIDTH_RATIO * size;

const measureEstimate = (input: TextMeasureInput): TextLayout => {
  const { size, lineHeight: multiplier } = input.style;
  const laid = layoutText(input, input.maxWidth, estimateWidth(size));
  const lineHeight = LINE_HEIGHT_RATIO * size * multiplier;
  return {
    lines: laid.lines,
    paragraphs: laid.paragraphs,
    lineRuns: laid.lineRuns,
    fontSize: size,
    lineHeight,
    ascent: ASCENT_RATIO * size * multiplier,
    width: laid.widestLine,
    height: laid.lines.length * lineHeight,
    widestSegment: laid.widestSegment,
    wordBroken: input.nowrap !== true && brokenWordsOf(input.content, laid.paragraphs).length > 0,
    truncated: laid.truncated,
    fontMissing: false,
  };
};

export const createEstimateMeasurer = (): TextMeasurer => measureEstimate;
