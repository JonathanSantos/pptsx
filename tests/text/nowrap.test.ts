import { describe, expect, it } from 'vitest';
import { createEstimateMeasurer, createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import type { TextMeasureInput, TextMeasurer } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';

/**
 * M8-B `nowrap`: cada parágrafo é uma linha só (sem quebra nem quebra por
 * caractere); wordBroken false; width pode passar de maxWidth; maxLines continua
 * cortando parágrafos.
 */

const style = textStyleOf({ size: 20 });
const LONG = 'um texto bem longo que normalmente quebraria em várias linhas';

describe.each([
  { name: 'fontkit', m: createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS), { safety: 1 }) as TextMeasurer },
  { name: 'estimate', m: createEstimateMeasurer() },
])('$name measurer — nowrap', ({ m }) => {
  const measure = (content: string, over: Partial<TextMeasureInput> = {}) =>
    m({ content, style, maxWidth: 80, nowrap: true, ...over });
  const unbounded = (content: string) => m({ content, style, maxWidth: Infinity });

  it('one line per paragraph', () => {
    const r = measure(`${LONG}\ncurto\n\n${LONG}`);
    expect(r.lines).toEqual([LONG, 'curto', '', LONG]);
    expect(r.paragraphs).toEqual([[LONG], ['curto'], [''], [LONG]]);
    expect(r.height).toBeCloseTo(4 * r.lineHeight, 6);
  });

  it('width can exceed maxWidth and equals the unbounded width', () => {
    const r = measure(LONG);
    expect(r.width).toBeGreaterThan(80);
    expect(r.width).toBeCloseTo(unbounded(LONG).width, 3);
  });

  it('wordBroken stays false even for a single word wider than maxWidth', () => {
    const r = measure('Supercalifragilisticexpialidocious', { maxWidth: 30 });
    expect(r.lines).toEqual(['Supercalifragilisticexpialidocious']);
    expect(r.wordBroken).toBe(false);
  });

  it('widestSegment is the whole widest line (the line is indivisible)', () => {
    const r = measure(`${LONG}\ncurto`);
    expect(r.widestSegment).toBeCloseTo(unbounded(LONG).width, 1);
  });

  it('without nowrap the same text wraps (control)', () => {
    expect(m({ content: LONG, style, maxWidth: 80 }).lines.length).toBeGreaterThan(1);
  });

  it('maxLines still cuts paragraphs', () => {
    const r = measure('primeiro\nsegundo\nterceiro', { maxLines: 2 });
    expect(r.truncated).toBe(true);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toBe('primeiro');
    expect(r.lines[1]!.endsWith('…')).toBe(true);
    expect(r.paragraphs.flat()).toEqual(r.lines);
  });

  it('maxLines ≥ paragraphs does not truncate', () => {
    const r = measure(`${LONG}\ncurto`, { maxLines: 2 });
    expect(r.truncated).toBe(false);
    expect(r.lines).toEqual([LONG, 'curto']);
  });

  it('lineRuns follow the lines', () => {
    const r = measure(`${LONG}\ncurto`);
    expect(r.lineRuns.map((parts) => parts.map((p) => p.text).join(''))).toEqual(r.lines);
  });
});
