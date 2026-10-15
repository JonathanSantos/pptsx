import type { TextLayout, TextMeasureInput, TextMeasurer, TextRun } from '../core/types.ts';
import { brokenWordsOf } from './broken.ts';
import { lineBoxOf, runSizeOf, spacingOf } from './leading.ts';
import { runsOfInput } from './source.ts';
import { layoutText } from './lines.ts';
import type { MeasureRun } from './pieces.ts';

// Proporções da estimativa (CONTRACTS §text): sem fonte real, tudo é fração do corpo.
const CHAR_WIDTH_RATIO = 0.5;
const LINE_HEIGHT_RATIO = 1.2;
const ASCENT_RATIO = 0.9;

// Sem métricas não há diferença entre faces: bold e itálico medem como a regular, NBSP como espaço.
const estimateWidth =
  (size: number, letterSpacing: number, runs: readonly TextRun[]): MeasureRun =>
  (text, run) =>
    [...text].length * CHAR_WIDTH_RATIO * runSizeOf(runs[run], size) + spacingOf(text, letterSpacing);

const measureEstimate = (input: TextMeasureInput): TextLayout => {
  const { size } = input.style;
  const laid = layoutText(input, input.maxWidth, estimateWidth(size, input.letterSpacing ?? 0, runsOfInput(input)));
  // A linha "natural" da estimativa faz o papel da face: 'normal' = 1.2 × size com baseline em 0.9 × size.
  const natural = { lineHeight: LINE_HEIGHT_RATIO * size, ascent: ASCENT_RATIO * size };
  const { lineHeight, ascent } = lineBoxOf(natural, size, input.style.lineHeight);
  return {
    lines: laid.lines,
    paragraphs: laid.paragraphs,
    lineRuns: laid.lineRuns,
    fontSize: size,
    lineHeight,
    ascent,
    width: laid.widestLine,
    height: laid.lines.length * lineHeight,
    widestSegment: laid.widestSegment,
    wordBroken: input.nowrap !== true && brokenWordsOf(input.content, laid.paragraphs).length > 0,
    truncated: laid.truncated,
    fontMissing: false,
  };
};

export const createEstimateMeasurer = (): TextMeasurer => measureEstimate;
