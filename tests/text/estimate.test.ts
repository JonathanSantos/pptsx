import { describe, expect, it } from 'vitest';
import { createEstimateMeasurer } from '../../src/text/index.ts';
import type { TextMeasureInput, TextStyle } from '../../src/core/types.ts';

/**
 * Medidor estimado (M2): caractere = 0.5 × size, linha = 1.2 × size × lineHeight,
 * ascent = 0.9 × size × lineHeight. Com size 10 cada caractere (inclusive espaço) mede 5 pt.
 * "Caber" é <= maxWidth (sem fator de segurança no estimador).
 */
const style = (over: Partial<TextStyle> = {}): TextStyle => ({
  family: 'Arial',
  size: 10,
  weight: 'regular',
  italic: false,
  lineHeight: 1,
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

  it('line height is 1.2 × size × lineHeight', () => {
    expect(measure('a', Infinity).lineHeight).toBeCloseTo(12);
    expect(measure('a', Infinity, {}, { size: 20, lineHeight: 1.5 }).lineHeight).toBeCloseTo(36);
  });

  it('ascent is 0.9 × size × lineHeight', () => {
    expect(measure('a', Infinity).ascent).toBeCloseTo(9);
    expect(measure('a', Infinity, {}, { size: 20, lineHeight: 1.5 }).ascent).toBeCloseTo(27);
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
