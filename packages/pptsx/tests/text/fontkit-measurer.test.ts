import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { FontFace, TextMeasureInput, TextStyle } from '../../src/core/types.ts';

/**
 * Medidor fontkit (M3). Os valores de referência são calculados aqui de forma
 * independente, abrindo a fonte com fontkit: largura de uma palavra =
 * Σ xAdvance de font.layout(palavra) × size / unitsPerEm; linha = palavras + espaços.
 */
const file = (name: string): string => fileURLToPath(new URL(`../../fonts/LiberationSans-${name}.ttf`, import.meta.url));

const FACES: readonly FontFace[] = [
  { family: 'Arial', weight: 'regular', file: file('Regular') },
  { family: 'Arial', weight: 'bold', file: file('Bold') },
  { family: 'Arial', weight: 'regular', italic: true, file: file('Italic') },
  { family: 'Arial', weight: 'bold', italic: true, file: file('BoldItalic') },
];

type Font = { unitsPerEm: number; ascent: number; descent: number; lineGap: number; layout: (s: string) => { positions: { xAdvance: number }[]; glyphs: { id: number; advanceWidth: number }[] } };
const open = (name: string): Font => fontkit.openSync(file(name)) as unknown as Font;
const REGULAR = open('Regular');
const BOLD = open('Bold');

/** Largura com kerning (layout) de um trecho sem espaços. */
const runWidth = (font: Font, text: string, size: number): number =>
  (font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) * size) / font.unitsPerEm;

/** Largura de uma linha medida palavra a palavra + espaços, como manda o contrato. */
const lineWidth = (font: Font, line: string, size: number): number => {
  const words = line.split(' ');
  const spaces = words.length - 1;
  return words.reduce((sum, w) => sum + (w ? runWidth(font, w, size) : 0), 0) + spaces * runWidth(font, ' ', size);
};

const naturalLineHeight = (font: Font, size: number): number =>
  ((font.ascent - font.descent + font.lineGap) / font.unitsPerEm) * size;

const style = (over: Partial<TextStyle> = {}): TextStyle => ({
  family: 'Arial',
  size: 20,
  weight: 'regular',
  italic: false,
  lineHeight: 'normal',
  ...over,
});

const registry = createFontRegistry(FACES);

const measure = (
  content: string,
  maxWidth: number,
  over: Partial<TextMeasureInput> = {},
  s: Partial<TextStyle> = {},
  safety = 1,
) => createFontkitMeasurer(registry, { safety })({ content, style: style(s), maxWidth, ...over });

const LOREM =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';

const EPS = 1e-6;

describe('createFontkitMeasurer — widths from real metrics', () => {
  it('"M" at 100 pt = advanceWidth × 100 / unitsPerEm', () => {
    const glyph = REGULAR.layout('M').glyphs[0]!;
    const expected = (glyph.advanceWidth * 100) / REGULAR.unitsPerEm;
    expect(measure('M', Infinity, {}, { size: 100 }).width).toBeCloseTo(expected, 6);
    expect(expected).toBeCloseTo(83.3, 1); // sanidade: 1706/2048 × 100
  });

  it('measures a single line as words + spaces', () => {
    const r = measure('Hello world', Infinity);
    expect(r.lines).toEqual(['Hello world']);
    expect(r.width).toBeCloseTo(lineWidth(REGULAR, 'Hello world', 20), 6);
  });

  it('width scales linearly with size', () => {
    const a = measure('Hello world', Infinity, {}, { size: 18 }).width;
    const b = measure('Hello world', Infinity, {}, { size: 36 }).width;
    expect(b).toBeCloseTo(2 * a, 6);
  });

  it('bold is wider than regular for the same text', () => {
    const regular = measure('Hello world', Infinity).width;
    const bold = measure('Hello world', Infinity, {}, { weight: 'bold' }).width;
    expect(bold).toBeGreaterThan(regular);
    expect(bold).toBeCloseTo(lineWidth(BOLD, 'Hello world', 20), 6);
  });

  it('applies kerning: "AV" and "To" are narrower than the sum of isolated advances', () => {
    for (const pair of ['AV', 'To']) {
      const together = measure(pair, Infinity, {}, { size: 100 }).width;
      const isolated = [...pair].reduce((sum, ch) => sum + measure(ch, Infinity, {}, { size: 100 }).width, 0);
      expect(together, pair).toBeLessThan(isolated);
      expect(together, pair).toBeCloseTo(runWidth(REGULAR, pair, 100), 6);
    }
  });

  it('reports fontSize = style.size', () => {
    expect(measure('x', Infinity, {}, { size: 33 }).fontSize).toBe(33);
  });

  it('measures pt-BR accents with real glyphs (no .notdef)', () => {
    const text = 'ação é ótimo à última';
    const r = measure(text, Infinity);
    expect(r.width).toBeGreaterThan(0);
    expect(r.width).toBeCloseTo(lineWidth(REGULAR, text, 20), 6);
    expect(REGULAR.layout('çãéóàú').glyphs.every((g) => g.id !== 0)).toBe(true);
  });
});

describe('createFontkitMeasurer — line height', () => {
  it("'normal' = (ascent − descent + lineGap) / unitsPerEm × size", () => {
    expect(measure('x', Infinity).lineHeight).toBeCloseTo(naturalLineHeight(REGULAR, 20), 6);
  });

  it('a numeric lineHeight is a multiple of the font size (CSS)', () => {
    expect(measure('x', Infinity, {}, { size: 30, lineHeight: 1.5 }).lineHeight).toBeCloseTo(45, 6);
    expect(measure('x', Infinity, {}, { size: 20, lineHeight: 1.2 }).lineHeight).toBeCloseTo(24, 6);
  });

  it('a numeric lineHeight moves the baseline down by the half-leading', () => {
    const natural = measure('x', Infinity, {}, { size: 20 });
    const spaced = measure('x', Infinity, {}, { size: 20, lineHeight: 1.2 });
    expect(spaced.ascent).toBeCloseTo(natural.ascent + (24 - natural.lineHeight) / 2, 6);
    expect(spaced.height).toBeCloseTo(24, 6);
  });

  it('height = lines × lineHeight', () => {
    const r = measure('a\nb\nc', Infinity);
    expect(r.lines).toHaveLength(3);
    expect(r.height).toBeCloseTo(3 * r.lineHeight, 6);
  });

  it('ascent is positive and within the line', () => {
    const r = measure('x', Infinity);
    expect(r.ascent).toBeGreaterThan(0);
    expect(r.ascent).toBeLessThanOrEqual(r.lineHeight);
  });
});

describe('createFontkitMeasurer — greedy wrap and safety', () => {
  const text = 'Hello world';
  const full = lineWidth(REGULAR, text, 20);

  it('fits on one line with safety 1 and wraps with safety 0.9', () => {
    const maxWidth = full / 0.95;
    expect(measure(text, maxWidth, {}, {}, 1).lines).toEqual(['Hello world']);
    expect(measure(text, maxWidth, {}, {}, 0.9).lines).toEqual(['Hello', 'world']);
  });

  it('uses DEFAULTS.textSafety when no safety is given', () => {
    const m = createFontkitMeasurer(registry);
    const fitsWithDefault = full / (DEFAULTS.textSafety - 0.01);
    const breaksWithDefault = full / (DEFAULTS.textSafety + 0.005);
    expect(m({ content: text, style: style(), maxWidth: fitsWithDefault }).lines).toHaveLength(1);
    expect(m({ content: text, style: style(), maxWidth: breaksWithDefault }).lines).toHaveLength(2);
  });

  it('no line exceeds maxWidth × safety', () => {
    for (const safety of [1, 0.9]) {
      const r = measure(LOREM, 200, {}, {}, safety);
      expect(r.lines.length).toBeGreaterThan(1);
      for (const line of r.lines) expect(lineWidth(REGULAR, line, 20), line).toBeLessThanOrEqual(200 * safety + EPS);
    }
  });

  it('is greedy: the next word would not fit on the previous line', () => {
    const r = measure(LOREM, 200);
    for (let i = 0; i < r.lines.length - 1; i++) {
      const nextWord = r.lines[i + 1]!.split(' ')[0]!;
      expect(lineWidth(REGULAR, `${r.lines[i]} ${nextWord}`, 20)).toBeGreaterThan(200);
    }
  });

  it('keeps all words in order', () => {
    const r = measure(LOREM, 200);
    expect(r.lines.join(' ')).toBe(LOREM);
  });

  it('no wrapped line starts or ends with a space', () => {
    const r = measure('a  lot   of   spaces  between   words here', 60);
    expect(r.lines.length).toBeGreaterThan(1);
    for (const line of r.lines) {
      expect(line).toBe(line.trim());
    }
  });

  it('width is the longest line, without trailing space', () => {
    const expected = Math.max(lineWidth(REGULAR, 'Hello', 20), lineWidth(REGULAR, 'world', 20));
    const r = measure(text, expected + 1);
    expect(r.lines).toEqual(['Hello', 'world']);
    expect(r.width).toBeCloseTo(expected, 6);
  });

  it('a trailing space in the content does not count in width', () => {
    expect(measure('Hello ', Infinity).width).toBeCloseTo(runWidth(REGULAR, 'Hello', 20), 6);
  });
});

describe('createFontkitMeasurer — word longer than the line', () => {
  const word = 'Supercalifragilisticexpialidocious';

  it('breaks by character and keeps every character', () => {
    const r = measure(word, 60);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.join('')).toBe(word);
  });

  it('no character-broken line exceeds maxWidth × safety', () => {
    for (const safety of [1, 0.9]) {
      const r = measure(word, 60, {}, {}, safety);
      for (const line of r.lines) expect(runWidth(REGULAR, line, 20), line).toBeLessThanOrEqual(60 * safety + EPS);
    }
  });

  it('a long word between short words keeps every character and respects the width', () => {
    const r = measure(`ab ${word} cd`, 60);
    expect(r.lines.join('').replace(/ /g, '')).toBe(`ab${word}cd`);
    for (const line of r.lines) expect(lineWidth(REGULAR, line, 20)).toBeLessThanOrEqual(60 + EPS);
  });
});

describe('createFontkitMeasurer — paragraphs', () => {
  it('splits paragraphs on \\n', () => {
    expect(measure('one\ntwo', Infinity).lines).toEqual(['one', 'two']);
  });

  it('an empty paragraph counts as a line', () => {
    const r = measure('one\n\ntwo', Infinity);
    expect(r.lines).toEqual(['one', '', 'two']);
    expect(r.height).toBeCloseTo(3 * r.lineHeight, 6);
  });

  it('Infinity gives one line per paragraph', () => {
    const r = measure(`${LOREM}\n${LOREM}`, Infinity);
    expect(r.lines).toEqual([LOREM, LOREM]);
  });

  it('wraps each paragraph independently', () => {
    const r = measure(`${LOREM}\nshort`, 200);
    expect(r.lines[r.lines.length - 1]).toBe('short');
    expect(r.lines.length).toBeGreaterThan(2);
  });
});

describe('createFontkitMeasurer — maxLines', () => {
  it('cuts to maxLines and ends with an ellipsis', () => {
    const r = measure(LOREM, 200, { maxLines: 2 });
    expect(r.lines).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(r.lines[1]!.endsWith('…')).toBe(true);
    expect(r.height).toBeCloseTo(2 * r.lineHeight, 6);
  });

  it('the truncated last line fits in maxWidth × safety', () => {
    for (const safety of [1, 0.9]) {
      const r = measure(LOREM, 200, { maxLines: 2 }, {}, safety);
      const last = r.lines[r.lines.length - 1]!;
      expect(lineWidth(REGULAR, last, 20)).toBeLessThanOrEqual(200 * safety + EPS);
    }
  });

  it('the first lines are unchanged by truncation', () => {
    const free = measure(LOREM, 200);
    const cut = measure(LOREM, 200, { maxLines: 2 });
    expect(cut.lines[0]).toBe(free.lines[0]);
  });

  it('does not truncate when the text fits in maxLines', () => {
    const r = measure('Hello world', Infinity, { maxLines: 2 });
    expect(r.truncated).toBe(false);
    expect(r.lines).toEqual(['Hello world']);
  });

  it('truncates paragraphs beyond maxLines', () => {
    const r = measure('a\nb\nc', Infinity, { maxLines: 2 });
    expect(r.lines).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(r.lines[1]!.endsWith('…')).toBe(true);
  });

  it('truncated is false without maxLines', () => {
    expect(measure(LOREM, 200).truncated).toBe(false);
  });
});

describe('createFontkitMeasurer — fontMissing', () => {
  it('registered family is not missing', () => {
    expect(measure('x', Infinity).fontMissing).toBe(false);
  });

  it('unregistered family → fontMissing true with a plausible result', () => {
    const r = measure(LOREM, 200, {}, { family: 'Nope' });
    expect(r.fontMissing).toBe(true);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.join(' ')).toBe(LOREM);
    expect(r.width).toBeGreaterThan(0);
    expect(r.lineHeight).toBeGreaterThan(0);
    expect(r.height).toBeCloseTo(r.lines.length * r.lineHeight, 6);
    expect(r.fontSize).toBe(20);
  });

  // M13: peso sem face usa a mais próxima e marca o pedido (font-weight-fallback no fit).
  it('unregistered weight → nearest face, requested weight recorded, no fontMissing', () => {
    const onlyRegular = createFontRegistry([FACES[0]!]);
    const r = createFontkitMeasurer(onlyRegular, { safety: 1 })({
      content: 'x',
      style: style({ weight: 'bold' }),
      maxWidth: Infinity,
    });
    expect(r.fontMissing).toBe(false);
    expect(r.faces?.[0]).toMatchObject({ weight: 400, requested: 700, bold: false });
  });

  it('italic without an italic face falls back to upright, without fontMissing', () => {
    const upright = createFontRegistry(FACES.filter((f) => !f.italic));
    const r = createFontkitMeasurer(upright, { safety: 1 })({
      content: 'Hello world',
      style: style({ italic: true }),
      maxWidth: Infinity,
    });
    expect(r.fontMissing).toBe(false);
    expect(r.width).toBeCloseTo(lineWidth(REGULAR, 'Hello world', 20), 6);
  });
});

describe('createFontkitMeasurer — determinism', () => {
  it('same input, same output', () => {
    const m = createFontkitMeasurer(registry);
    const input: TextMeasureInput = { content: `${LOREM}\n\nfim`, style: style({ weight: 'bold' }), maxWidth: 180, maxLines: 4 };
    expect(m(input)).toEqual(m(input));
    expect(createFontkitMeasurer(registry)(input)).toEqual(m(input));
  });
});

describe('createFontkitMeasurer — paragraphs grouping (M3-H)', () => {
  const coherent = (r: { lines: readonly string[]; paragraphs: readonly (readonly string[])[] }) =>
    expect(r.paragraphs.flat()).toEqual(r.lines);

  it('groups lines by \\n paragraph', () => {
    const r = measure('one\ntwo', Infinity);
    expect(r.paragraphs).toEqual([['one'], ['two']]);
    coherent(r);
  });

  it('an empty line is its own paragraph with one empty line', () => {
    const r = measure('one\n\ntwo', Infinity);
    expect(r.paragraphs).toEqual([['one'], [''], ['two']]);
    coherent(r);
  });

  it('wrapped lines stay inside their paragraph', () => {
    const r = measure(`${LOREM}\nshort`, 200);
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[0]!.length).toBeGreaterThan(1);
    expect(r.paragraphs[1]).toEqual(['short']);
    coherent(r);
  });

  it('maxLines inside the first paragraph drops the following paragraphs', () => {
    const r = measure(`${LOREM}\nshort`, 200, { maxLines: 2 });
    expect(r.truncated).toBe(true);
    expect(r.paragraphs).toHaveLength(1);
    expect(r.paragraphs[0]).toHaveLength(2);
    expect(r.paragraphs[0]![1]!.endsWith('…')).toBe(true);
    coherent(r);
  });

  it('maxLines inside a later paragraph keeps the earlier ones whole', () => {
    const r = measure(`one\n${LOREM}\nlast`, 200, { maxLines: 3 });
    expect(r.truncated).toBe(true);
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[0]).toEqual(['one']);
    expect(r.paragraphs[1]).toHaveLength(2);
    expect(r.paragraphs[1]![1]!.endsWith('…')).toBe(true);
    coherent(r);
  });

  it('maxLines across one-line paragraphs', () => {
    const r = measure('a\nb\nc', Infinity, { maxLines: 2 });
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[0]).toEqual(['a']);
    expect(r.paragraphs[1]![0]!.endsWith('…')).toBe(true);
    coherent(r);
  });

  it('character-broken word stays in one paragraph', () => {
    const r = measure('Supercalifragilisticexpialidocious', 60);
    expect(r.paragraphs).toHaveLength(1);
    coherent(r);
  });
});

describe('createFontkitMeasurer — break points after "-" and "/" (M3-H)', () => {
  it('breaks after "-" keeping it at the end of the line', () => {
    const max = runWidth(REGULAR, 'bem-estar', 20) - 1;
    const r = measure('bem-estar', max);
    expect(r.lines).toEqual(['bem-', 'estar']);
    expect(r.paragraphs).toEqual([['bem-', 'estar']]);
  });

  it('breaks a URL after "/" keeping it at the end of the line', () => {
    const url = 'https://example.com/docs/page';
    const max = runWidth(REGULAR, 'https://example.com/docs/', 20) + 1;
    expect(max).toBeLessThan(runWidth(REGULAR, url, 20));
    const r = measure(url, max);
    expect(r.lines).toEqual(['https://example.com/docs/', 'page']);
  });

  it('does not break at "-" or "/" when the text fits', () => {
    expect(measure('bem-estar a/b', Infinity).lines).toEqual(['bem-estar a/b']);
  });

  it('a word without break points still breaks by character', () => {
    const word = 'Supercalifragilisticexpialidocious';
    const r = measure(word, 60);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.join('')).toBe(word);
  });
});
