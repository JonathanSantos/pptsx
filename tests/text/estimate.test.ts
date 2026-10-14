import { describe, expect, it } from 'vitest';
import { createEstimateMeasurer } from '../../src/text/index.ts';
import type { TextMeasureInput, TextStyle } from '../../src/core/types.ts';

/**
 * Medidor estimado (M2): caractere = 0.5 × size; linha natural ('normal') = 1.2 × size com
 * ascent 0.9 × size. M11 (CSS): lineHeight numérico n = n × size por linha, e a baseline desce a
 * meia-entrelinha (n × size − 1.2 × size) / 2. Com size 10 cada caractere (inclusive espaço) mede 5 pt.
 * "Caber" é <= maxWidth (sem fator de segurança no estimador).
 */
const style = (over: Partial<TextStyle> = {}): TextStyle => ({
  family: 'Arial',
  size: 10,
  weight: 'regular',
  italic: false,
  lineHeight: 'normal',
  ...over,
});

const measure = (content: string, maxWidth: number, over: Partial<TextMeasureInput> = {}, s: Partial<TextStyle> = {}) =>
  createEstimateMeasurer()({ content, style: style(s), maxWidth, ...over });

describe('createEstimateMeasurer — metrics', () => {
  it('measures each character as 0.5 × size', () => {
    expect(measure('abcd', Infinity).width).toBeCloseTo(20);
    expect(measure('abcd', Infinity, {}, { size: 20 }).width).toBeCloseTo(40);
  });

  it('counts spaces between words as characters', () => {
    expect(measure('ab cd', Infinity).width).toBeCloseTo(25);
  });

  it("line height is 1.2 × size for 'normal' and n × size for a number", () => {
    expect(measure('a', Infinity).lineHeight).toBeCloseTo(12);
    expect(measure('a', Infinity, {}, { size: 20, lineHeight: 1.5 }).lineHeight).toBeCloseTo(30);
  });

  it("ascent is 0.9 × size for 'normal', shifted by the half-leading for a number", () => {
    expect(measure('a', Infinity).ascent).toBeCloseTo(9);
    expect(measure('a', Infinity, {}, { size: 20, lineHeight: 1.5 }).ascent).toBeCloseTo((30 - 24) / 2 + 18);
  });

  it('reports fontSize = style.size', () => {
    expect(measure('a', Infinity, {}, { size: 33 }).fontSize).toBe(33);
  });

  it('never reports fontMissing', () => {
    expect(measure('a', Infinity).fontMissing).toBe(false);
    expect(measure('a', Infinity, {}, { family: 'Nope', weight: 'bold', italic: true }).fontMissing).toBe(false);
  });

  it('is a pure function: same input, same output', () => {
    const m = createEstimateMeasurer();
    const input = { content: 'hello world again', style: style(), maxWidth: 40 };
    expect(m(input)).toEqual(m(input));
  });
});

describe('createEstimateMeasurer — greedy word wrap', () => {
  it('keeps text on one line when it fits', () => {
    const r = measure('aaa bbb', 40);
    expect(r.lines).toEqual(['aaa bbb']);
    expect(r.truncated).toBe(false);
  });

  it('a line exactly as wide as maxWidth fits (<=)', () => {
    expect(measure('aaaa bbb', 40).lines).toEqual(['aaaa bbb']);
  });

  it('breaks greedily between words', () => {
    expect(measure('aaa bbb ccc', 40).lines).toEqual(['aaa bbb', 'ccc']);
  });

  it('fills each line with as many words as fit', () => {
    expect(measure('aa bb cc dd ee', 47).lines).toEqual(['aa bb cc', 'dd ee']);
  });

  it('breaks a word longer than the line by character', () => {
    expect(measure('abcdefghij', 22).lines).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('breaks a long word after a short one by character', () => {
    const r = measure('ab abcdefghij', 22);
    expect(r.lines.join('')).toBe('ababcdefghij');
    r.lines.forEach((line) => expect(line.length * 5).toBeLessThanOrEqual(22));
  });

  it('width is the longest line, without trailing spaces', () => {
    const r = measure('aaa bbb ccc', 40);
    expect(r.width).toBeCloseTo(35);
  });

  it('height = lines × lineHeight', () => {
    const r = measure('aaa bbb ccc ddd eee', 40);
    expect(r.lines).toHaveLength(3);
    expect(r.height).toBeCloseTo(3 * 12);
  });
});

describe('createEstimateMeasurer — paragraphs', () => {
  it('splits paragraphs on \\n', () => {
    expect(measure('one\ntwo', Infinity).lines).toEqual(['one', 'two']);
  });

  it('counts an empty paragraph as a line', () => {
    const r = measure('a\n\nb', Infinity);
    expect(r.lines).toEqual(['a', '', 'b']);
    expect(r.height).toBeCloseTo(3 * 12);
  });

  it('wraps each paragraph independently', () => {
    expect(measure('aaa bbb ccc\nddd', 40).lines).toEqual(['aaa bbb', 'ccc', 'ddd']);
  });

  it('maxWidth Infinity gives one line per paragraph', () => {
    const long = 'word '.repeat(200).trim();
    const r = measure(`${long}\n${long}`, Infinity);
    expect(r.lines).toEqual([long, long]);
    expect(r.width).toBeCloseTo(long.length * 5);
  });
});

describe('createEstimateMeasurer — maxLines', () => {
  it('cuts to maxLines and ends the last line with an ellipsis that fits', () => {
    const r = measure('aaa bbb ccc ddd eee', 40, { maxLines: 2 });
    expect(r.lines).toEqual(['aaa bbb', 'ccc ddd…']);
    expect(r.truncated).toBe(true);
  });

  it('height reflects the truncated line count', () => {
    const r = measure('aaa bbb ccc ddd eee', 40, { maxLines: 2 });
    expect(r.height).toBeCloseTo(2 * 12);
  });

  it('the truncated last line still fits the width', () => {
    const r = measure('aaa bbb ccc ddd eee', 40, { maxLines: 2 });
    expect(r.width).toBeLessThanOrEqual(40);
  });

  it('applies maxLines across paragraphs', () => {
    const r = measure('a\nb\nc', Infinity, { maxLines: 2 });
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toBe('a');
    expect(r.lines[1]?.endsWith('…')).toBe(true);
    expect(r.truncated).toBe(true);
  });

  it('does not truncate when the text fits in maxLines', () => {
    const r = measure('aaa bbb ccc', 40, { maxLines: 2 });
    expect(r.lines).toEqual(['aaa bbb', 'ccc']);
    expect(r.truncated).toBe(false);
  });
});

describe('createEstimateMeasurer — paragraphs grouping (M3-H)', () => {
  const coherent = (r: { lines: readonly string[]; paragraphs: readonly (readonly string[])[] }) =>
    expect(r.paragraphs.flat()).toEqual(r.lines);

  it('one paragraph without \\n', () => {
    const r = measure('aaa bbb', 40);
    expect(r.paragraphs).toEqual([['aaa bbb']]);
    coherent(r);
  });

  it('groups lines by \\n paragraph', () => {
    const r = measure('one\ntwo', Infinity);
    expect(r.paragraphs).toEqual([['one'], ['two']]);
    coherent(r);
  });

  it('an empty line is its own paragraph with one empty line', () => {
    const r = measure('a\n\nb', Infinity);
    expect(r.paragraphs).toEqual([['a'], [''], ['b']]);
    coherent(r);
  });

  it('wrapped lines stay inside their paragraph', () => {
    const r = measure('aaa bbb ccc\nddd', 40);
    expect(r.paragraphs).toEqual([['aaa bbb', 'ccc'], ['ddd']]);
    coherent(r);
  });

  it('maxLines: paragraphs beyond the cut disappear and the last keeps the remaining lines', () => {
    const r = measure('aaa bbb ccc ddd eee\nfff', 40, { maxLines: 2 });
    expect(r.truncated).toBe(true);
    expect(r.paragraphs).toEqual([['aaa bbb', 'ccc ddd…']]);
    coherent(r);
  });

  it('maxLines cutting inside the second paragraph', () => {
    const r = measure('aaa\nbbb ccc ddd', 40, { maxLines: 2 });
    expect(r.truncated).toBe(true);
    expect(r.paragraphs).toEqual([['aaa'], ['bbb ccc…']]);
    coherent(r);
  });

  it('maxLines across one-line paragraphs', () => {
    const r = measure('a\nb\nc', Infinity, { maxLines: 2 });
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[0]).toEqual(['a']);
    expect(r.paragraphs[1]).toHaveLength(1);
    expect(r.paragraphs[1]![0]!.endsWith('…')).toBe(true);
    coherent(r);
  });

  it('character-broken word stays in one paragraph', () => {
    const r = measure('abcdefghij', 22);
    expect(r.paragraphs).toEqual([['abcd', 'efgh', 'ij']]);
    coherent(r);
  });
});

describe('createEstimateMeasurer — break points after "-" and "/" (M3-H)', () => {
  it('breaks after "-" keeping it at the end of the line', () => {
    // 'bem-estar' = 45 pt > 40; 'bem-' = 20 cabe; char-break daria 'bem-esta' + 'r'.
    const r = measure('bem-estar', 40);
    expect(r.lines).toEqual(['bem-', 'estar']);
    expect(r.paragraphs).toEqual([['bem-', 'estar']]);
  });

  it('packs words before the hyphen break greedily', () => {
    expect(measure('a bem-estar', 40).lines).toEqual(['a bem-', 'estar']);
  });

  it('breaks a URL after "/" keeping it at the end of the line', () => {
    // segmentos: 'site.com/' (45) 'docs/' (25) 'page' (20); limite 50.
    const r = measure('site.com/docs/page', 50);
    expect(r.lines).toEqual(['site.com/', 'docs/page']);
    expect(r.lines.join('')).toBe('site.com/docs/page');
  });

  it('does not break at "-" or "/" when the text fits', () => {
    expect(measure('bem-estar a/b', Infinity).lines).toEqual(['bem-estar a/b']);
  });

  it('a word without break points still breaks by character', () => {
    expect(measure('abcdefghij', 22).lines).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('a segment longer than the line after a hyphen still breaks by character', () => {
    const r = measure('ab-cdefghijkl', 22);
    expect(r.lines.join('')).toBe('ab-cdefghijkl');
    r.lines.forEach((line) => expect(line.length * 5).toBeLessThanOrEqual(22));
  });
});
