import { describe, expect, it } from 'vitest';
import { createEstimateMeasurer, createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import type { TextMeasureInput, TextMeasurer, TextStyle } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { fileURLToPath } from 'node:url';
import * as fontkitLib from 'fontkit';

/**
 * CONTRACTS §text regra 9b (M6): widestSegment = largura do maior segmento indivisível
 * do texto inteiro, no size atual, antes de quebra por caractere ou truncamento.
 */

const estimate = createEstimateMeasurer();
const fontkit = createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS));

const style = (over: Partial<TextStyle> = {}): TextStyle => ({ ...textStyleOf({ size: 10 }), ...over });
const measureWith = (m: TextMeasurer, content: string, over: Partial<TextMeasureInput> = {}, s: Partial<TextStyle> = {}) =>
  m({ content, style: style(s), maxWidth: Infinity, ...over });

describe('widestSegment — estimator (0.5 × size per character)', () => {
  const w = (content: string, over: Partial<TextMeasureInput> = {}, s: Partial<TextStyle> = {}) =>
    measureWith(estimate, content, over, s).widestSegment;

  it('is the width of the longest word', () => {
    expect(w('ab abcd abc')).toBeCloseTo(20);
  });

  it('empty text → 0', () => {
    expect(w('')).toBe(0);
  });

  it('scales with size', () => {
    expect(w('abcd', {}, { size: 20 })).toBeCloseTo(40);
  });

  it('looks at every paragraph', () => {
    expect(w('ab\nabcdefg')).toBeCloseTo(35);
  });

  it('a hyphen is a break point kept with the left segment', () => {
    expect(w('abcdef-gh')).toBeCloseTo(35);
  });

  it('does not change with maxWidth, even when the word breaks by character', () => {
    const wide = measureWith(estimate, 'ab abcdefghij', { maxWidth: Infinity });
    const narrow = measureWith(estimate, 'ab abcdefghij', { maxWidth: 20 });
    expect(narrow.wordBroken).toBe(true);
    expect(narrow.widestSegment).toBeCloseTo(wide.widestSegment);
    expect(wide.widestSegment).toBeCloseTo(50);
  });

  it('is measured before truncation (maxLines)', () => {
    expect(w('a\nabcdefgh', { maxLines: 1 })).toBeCloseTo(40);
  });
});

type Font = { unitsPerEm: number; layout: (s: string) => { positions: { xAdvance: number }[] } };
const REGULAR = fontkitLib.openSync(
  fileURLToPath(new URL('../../fonts/LiberationSans-Regular.ttf', import.meta.url)),
) as unknown as Font;

describe('widestSegment — fontkit measurer', () => {
  /** Referência independente: Σ xAdvance de font.layout(segmento) × size / unitsPerEm (regra 2). */
  const segmentWidth = (segment: string, size = 24): number =>
    (REGULAR.layout(segment).positions.reduce((sum, p) => sum + p.xAdvance, 0) * size) / REGULAR.unitsPerEm;
  const at = (content: string, over: Partial<TextMeasureInput> = {}, size = 24) =>
    fontkit({ content, style: textStyleOf({ size }), maxWidth: Infinity, ...over });

  it('equals the width of the widest segment measured alone', () => {
    const words = ['Lorem', 'ipsum', 'consectetur', 'sit'];
    const expected = Math.max(...words.map((word) => segmentWidth(word)));
    expect(at(words.join(' ')).widestSegment).toBeCloseTo(expected, 4);
    expect(expected).toBeCloseTo(segmentWidth('consectetur'), 6);
  });

  it('a single segment: widestSegment is the natural width (width carries the safety slack)', () => {
    const one = at('Desligamento');
    expect(one.widestSegment).toBeCloseTo(segmentWidth('Desligamento'), 4);
    expect(one.widestSegment).toBeLessThanOrEqual(one.width + 1e-6);
  });

  it('empty text → 0', () => {
    expect(at('').widestSegment).toBe(0);
  });

  it('scales linearly with size', () => {
    expect(at('Desligamento', {}, 48).widestSegment).toBeCloseTo(2 * at('Desligamento', {}, 24).widestSegment, 4);
  });

  it('does not change with maxWidth, even when the word breaks by character', () => {
    const content = 'ok Desligamento';
    const wide = at(content);
    const narrow = at(content, { maxWidth: 60 });
    expect(narrow.wordBroken).toBe(true);
    expect(narrow.widestSegment).toBeCloseTo(wide.widestSegment, 6);
    expect(at(content, { maxWidth: 300 }).widestSegment).toBeCloseTo(wide.widestSegment, 6);
  });

  it('looks at every paragraph and ignores maxLines', () => {
    const content = 'ok\nDesligamento';
    expect(at(content, { maxLines: 1 }).widestSegment).toBeCloseTo(segmentWidth('Desligamento'), 4);
  });

  it('missing font → estimated widestSegment (0.5 × size per character)', () => {
    const missing = fontkit({ content: 'ab abcd', style: { ...textStyleOf({ size: 10 }), family: 'Inter' }, maxWidth: Infinity });
    expect(missing.fontMissing).toBe(true);
    expect(missing.widestSegment).toBeCloseTo(20);
  });
});
