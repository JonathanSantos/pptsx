import { describe, expect, it } from 'vitest';
import { brokenWordsOf, createEstimateMeasurer, createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import type { TextMeasurer } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';

/**
 * M8-B: U+00A0 é glue — não é ponto de quebra, fica dentro do segmento e é
 * medido como espaço. brokenWordsOf usa a mesma regra.
 */

const NBSP = ' ';
const MONEY = `R$ 52,4${NBSP}mi`;

const style = textStyleOf({ size: 20 });

describe.each([
  { name: 'fontkit', m: createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS), { safety: 1 }) as TextMeasurer },
  { name: 'estimate', m: createEstimateMeasurer() },
])('$name measurer — NBSP', ({ m }) => {
  const widthOf = (content: string): number => m({ content, style, maxWidth: Infinity }).width;

  it(`"R$ 52,4 mi" where "mi" does not fit: breaks before "52,4 mi", never inside`, () => {
    const maxWidth = Math.max(widthOf('R$ 52,4'), widthOf('52,4 mi')) + 1;
    expect(widthOf('R$ 52,4 mi')).toBeGreaterThan(maxWidth);
    const r = m({ content: MONEY, style, maxWidth });
    expect(r.lines).toEqual(['R$', `52,4${NBSP}mi`]);
    expect(r.wordBroken).toBe(false);
    expect(r.lineRuns.map((parts) => parts.map((p) => p.text).join(''))).toEqual(r.lines);
  });

  it('brokenWordsOf does not flag the NBSP join', () => {
    const maxWidth = Math.max(widthOf('R$ 52,4'), widthOf('52,4 mi')) + 1;
    const r = m({ content: MONEY, style, maxWidth });
    expect(brokenWordsOf(MONEY, r.paragraphs)).toEqual([]);
  });

  it('widestSegment includes the NBSP (the whole "52,4 mi")', () => {
    const r = m({ content: MONEY, style, maxWidth: Infinity });
    expect(r.widestSegment).toBeCloseTo(widthOf('52,4 mi'), 1);
    expect(r.widestSegment).toBeGreaterThan(widthOf('52,4') + 1);
  });

  it('NBSP is measured as a space', () => {
    expect(widthOf(`a${NBSP}b`)).toBeCloseTo(widthOf('a b'), 1);
    expect(widthOf(MONEY)).toBeCloseTo(widthOf('R$ 52,4 mi'), 1);
  });

  it('a regular space is still a break point next to an NBSP', () => {
    const maxWidth = widthOf(`x${NBSP}y`) + 1;
    const r = m({ content: `x${NBSP}y z`, style, maxWidth });
    expect(r.lines).toEqual([`x${NBSP}y`, 'z']);
  });

  it('NBSP survives in the lines (not normalized to a regular space)', () => {
    const r = m({ content: `a${NBSP}b c`, style, maxWidth: Infinity });
    expect(r.lines).toEqual([`a${NBSP}b c`]);
  });
});
