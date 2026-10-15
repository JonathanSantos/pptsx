import { describe, expect, it } from 'vitest';
import { createFontkitMeasurer, createFontRegistry } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { Deck, Slide, Span, Sub, Sup, Text } from '../../src/primitives/index.ts';
import type { SlideElement, TextRun } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

const measure = createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS), { safety: 1 });
const style = { family: 'Arial', size: 30, weight: 'regular' as const, italic: false, lineHeight: 'normal' as const };
const run = (text: string, verticalAlign?: TextRun['verticalAlign']): TextRun => ({ text, weight: 'regular', italic: false, color: '#000000', ...(verticalAlign ? { verticalAlign } : {}) });
const widthOf = (runs: readonly TextRun[]) => measure({ content: runs.map((r) => r.text).join(''), style, runs, maxWidth: Infinity });

describe('M13-3 — medição', () => {
  it('largura de "m²" = m + 2/3 × "2"', () => {
    const m = widthOf([run('m')]).width;
    const two = widthOf([run('2')]).width;
    expect(widthOf([run('m'), run('2', 'super')]).width).toBeCloseTo(m + two * DEFAULTS.text.superscriptRatio, 6);
    expect(widthOf([run('m'), run('2', 'sub')]).width).toBeCloseTo(m + two * DEFAULTS.text.superscriptRatio, 6);
  });

  it('a altura e a baseline da linha não mudam', () => {
    const plain = widthOf([run('m2')]);
    const sup = widthOf([run('m'), run('2', 'super')]);
    expect(sup.lineHeight).toBe(plain.lineHeight);
    expect(sup.ascent).toBe(plain.ascent);
  });
});

const ctx = createContext(resolveSize('16x9'));
const runsOfText = (children: unknown) => {
  const deck = resolveDeck((<Deck><Slide><Text>{children as never}</Text></Slide></Deck>) as SlideElement, ctx);
  const text = deck.slides[0]!.children[0]!;
  if (text.kind !== 'text') throw new Error('text');
  return text.runs;
};

describe('M13-3 — resolve', () => {
  it('Sup/Sub e Span verticalAlign viram runs próprios; baseline não entra no run', () => {
    expect(runsOfText(<>m<Sup>2</Sup> H<Sub>2</Sub>O <Span verticalAlign="baseline">x</Span></>).map((r) => [r.text, r.verticalAlign])).toEqual([
      ['m', undefined],
      ['2', 'super'],
      [' H', undefined],
      ['2', 'sub'],
      ['O x', undefined],
    ]);
  });

  it('verticalAlign inválido → ResolveError', () => {
    expect(() => runsOfText(<Span verticalAlign={'top' as never}>x</Span>)).toThrow(/verticalAlign/);
  });
});

describe('M13-3 — emissão e preview', () => {
  it('XML: baseline 30000 / -25000 sem mudar sz; preview com corpo reduzido e baseline-shift', async () => {
    const { xml, svg } = await build(<Deck><Slide><Text fontSize={30}>m<Sup>2</Sup> H<Sub>2</Sub>O</Text></Slide></Deck>);
    expect(xml[0]).toMatch(/<a:rPr[^>]*sz="3000"[^>]*baseline="30000"/);
    expect(xml[0]).toMatch(/<a:rPr[^>]*sz="3000"[^>]*baseline="-25000"/);
    expect(svg[0]).toContain('font-size="20"');
    expect(svg[0]).toContain('baseline-shift="9"');
    expect(svg[0]).toContain('baseline-shift="-7.5"');
  });
});
