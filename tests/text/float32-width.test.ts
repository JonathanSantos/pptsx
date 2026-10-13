import { describe, expect, it } from 'vitest';
import { createEstimateMeasurer, createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { breakLines } from '../../src/text/lines.ts';
import { DEFAULT_FONTS } from '../../src/fonts.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { TextMeasurer, TextStyle } from '../../src/core/types.ts';

/**
 * Regressão: o Yoga devolve larguras em float32. Um texto medido numa largura W
 * volta com frame ≈ W − 1e-6; a remedição não pode quebrar a linha por isso
 * (tolerância de 0.01 pt na comparação de largura).
 */

const style = (size: number, weight: TextStyle['weight'] = 'regular'): TextStyle => ({
  family: 'Arial',
  size,
  weight,
  italic: false,
  lineHeight: 1,
});

describe('breakLines — float32 width tolerance', () => {
  const measureWidth = (text: string) => [...text].length * 7.3;
  const W = measureWidth('Perguntas?');

  it.each([
    ['exact', W],
    ['Math.fround', Math.fround(W)],
    ['W − 1e-5', W - 1e-5],
  ])('keeps the text on one line at %s width', (_name, maxWidth) => {
    expect(breakLines('Perguntas?', maxWidth, measureWidth)).toEqual(['Perguntas?']);
  });

  it('still wraps when the width is clearly smaller (beyond the tolerance)', () => {
    expect(breakLines('Perguntas?', W - 0.5, measureWidth).length).toBeGreaterThan(1);
  });
});

const MEASURERS: readonly (readonly [string, TextMeasurer, number])[] = [
  ['estimate', createEstimateMeasurer(), 1],
  ['fontkit', createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS)), DEFAULTS.textSafety],
];

describe.each(MEASURERS)('%s measurer — remeasure at float32 width', (_name, measure, safety) => {
  it.each([
    ['Perguntas?', 40, 'bold'],
    ['Perguntas?', 20, 'regular'],
    ['Receita anual consolidada', 24, 'regular'],
  ] as const)('"%s" at %d pt stays on one line', (content, size, weight) => {
    const natural = measure({ content, style: style(size, weight), maxWidth: Infinity });
    const W = natural.width / safety;
    for (const maxWidth of [Math.fround(W), W - 1e-5]) {
      const r = measure({ content, style: style(size, weight), maxWidth });
      expect(r.lines, `maxWidth=${maxWidth}`).toEqual([content]);
      expect(r.wordBroken).toBe(false);
      const truncated = measure({ content, style: style(size, weight), maxWidth, maxLines: 1 });
      expect(truncated.lines).toEqual([content]);
      expect(truncated.truncated).toBe(false);
    }
  });
});
