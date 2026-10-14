import type { Font } from 'fontkit';
import { DEFAULTS } from '../../../src/core/defaults.ts';
import type { Pt, TextLayout } from '../../../src/core/types.ts';
import { brokenWordsOf, createFontkitMeasurer, type FontRegistry } from '../../../src/text/index.ts';
import { baselineOffset } from '../../../src/text/fontkit.ts';
import { layoutText } from '../../../src/text/lines.ts';
import type { MeasureRun } from '../../../src/text/pieces.ts';
import { runsOfInput } from '../../../src/text/source.ts';
import type { TextMeasureInput, TextMeasurer } from '../types.ts';

/**
 * Medidor da PoC: o fontkit da engine, mais `letterSpacing` (pt somados a cada caractere,
 * como o CSS e o `spc` do PPTX). Sem letterSpacing chama o medidor de src sem mudança
 * nenhuma, então a calibração (H2) e as posições (H3) não podem divergir por aqui.
 */

// NBSP mede como espaço (mesma regra de src/text/fontkit.ts).
const NBSP = / /g;

const spacedWidth =
  (font: Font, size: Pt, spacing: Pt) =>
  (text: string): Pt => {
    if (text.length === 0) return 0;
    const units = font.layout(text.replace(NBSP, ' ')).positions.reduce((sum, position) => sum + position.xAdvance, 0);
    return (units * size) / font.unitsPerEm + spacing * [...text].length;
  };

const boxWidthOf = (widest: Pt, maxWidth: Pt, safety: number, nowrap: boolean): Pt =>
  nowrap ? widest / safety : Math.min(widest / safety, maxWidth);

/** measureWithFonts de src/text/fontkit.ts com a largura espaçada. */
const measureSpaced = (metricsFont: Font, measure: MeasureRun, input: TextMeasureInput, safety: number): TextLayout => {
  const { size, lineHeight: multiplier } = input.style;
  const nowrap = input.nowrap === true;
  const laid = layoutText(input, input.maxWidth * safety, measure);
  const natural = ((metricsFont.ascent - metricsFont.descent + metricsFont.lineGap) / metricsFont.unitsPerEm) * size;
  const lineHeight = natural * multiplier;
  const metrics = { unitsPerEm: metricsFont.unitsPerEm, ascent: metricsFont.ascent, descent: metricsFont.descent, lineGap: metricsFont.lineGap };
  return {
    lines: laid.lines,
    paragraphs: laid.paragraphs,
    lineRuns: laid.lineRuns,
    fontSize: size,
    lineHeight,
    ascent: baselineOffset(metrics, size, multiplier),
    width: boxWidthOf(laid.widestLine, input.maxWidth, safety, nowrap),
    height: laid.lines.length * lineHeight,
    widestSegment: laid.widestSegment,
    wordBroken: !nowrap && brokenWordsOf(input.content, laid.paragraphs).length > 0,
    truncated: laid.truncated,
    fontMissing: false,
  };
};

export const createCssMeasurer = (registry: FontRegistry, safety: number = DEFAULTS.textSafety): TextMeasurer => {
  const base = createFontkitMeasurer(registry, { safety });
  return (input) => {
    const spacing = input.letterSpacing ?? 0;
    if (spacing === 0) return base(input);
    const { family, size, weight, italic } = input.style;
    const fonts = runsOfInput(input).map((run) => registry.get(family, run.weight, run.italic));
    const metricsFont = registry.get(family, weight, italic) ?? fonts[0];
    // Face ausente: o medidor da engine já devolve a estimativa marcada; o espaçamento não muda isso.
    if (metricsFont === undefined || fonts.some((font) => font === undefined)) return base(input);
    const widths = (fonts as readonly Font[]).map((font) => spacedWidth(font, size, spacing));
    const measure: MeasureRun = (text, run) => widths[run]?.(text) ?? 0;
    return measureSpaced(metricsFont, measure, input, safety);
  };
};
