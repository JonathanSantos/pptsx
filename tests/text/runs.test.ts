import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { createEstimateMeasurer, createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import type { FontWeight, TextLayout, TextMeasureInput, TextMeasurer, TextRun, TextStyle } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';

/**
 * M8-B: medição por run. A largura de um segmento é a soma das partes, cada uma
 * medida com a face do seu run (kerning não cruza fronteira de run); `lineRuns`
 * divide cada linha por run com join('') === lines[i].
 */

const fontFile = (name: string): string =>
  fileURLToPath(new URL(`../../fonts/LiberationSans-${name}.ttf`, import.meta.url));

type Font = { unitsPerEm: number; layout: (s: string) => { positions: { xAdvance: number }[] } };
const open = (name: string): Font => fontkit.openSync(fontFile(name)) as unknown as Font;
const REGULAR = open('Regular');
const BOLD = open('Bold');

/** Largura com kerning de um trecho, numa face. */
const widthIn = (font: Font, text: string, size: number): number =>
  (font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) * size) / font.unitsPerEm;

const registry = createFontRegistry(DEFAULT_FONTS);
const fontkitExact = createFontkitMeasurer(registry, { safety: 1 });
const estimate = createEstimateMeasurer();

const SIZE = 20;
const style = (over: Partial<TextStyle> = {}): TextStyle => ({ ...textStyleOf({ size: SIZE }), ...over });

const run = (text: string, weight: FontWeight = 'regular', italic = false, color = '#000000'): TextRun => ({
  text,
  weight,
  italic,
  color,
});

const contentOf = (runs: readonly TextRun[]): string => runs.map((r) => r.text).join('');

const measureRuns = (
  m: TextMeasurer,
  runs: readonly TextRun[],
  maxWidth: number,
  over: Partial<TextMeasureInput> = {},
): TextLayout => m({ content: contentOf(runs), runs, style: style(), maxWidth, ...over });

/** Invariantes de lineRuns/paragraphs (CONTRACTS M8 §text). */
const expectCoherent = (r: TextLayout, runCount: number): void => {
  expect(r.paragraphs.flat()).toEqual(r.lines);
  expect(r.lineRuns).toHaveLength(r.lines.length);
  r.lineRuns.forEach((parts, i) => {
    expect(parts.map((p) => p.text).join(''), `line ${i}`).toBe(r.lines[i]);
    if (r.lines[i] === '') expect(parts, `empty line ${i}`).toEqual([]);
    parts.forEach((p) => {
      expect(Number.isInteger(p.run)).toBe(true);
      expect(p.run).toBeGreaterThanOrEqual(0);
      expect(p.run).toBeLessThan(Math.max(runCount, 1));
    });
  });
  // Runs aparecem na ordem do texto: os índices nunca voltam.
  const indices = r.lineRuns.flat().map((p) => p.run);
  indices.forEach((value, i) => {
    if (i > 0) expect(value, `run order at ${i}`).toBeGreaterThanOrEqual(indices[i - 1]!);
  });
};

// ───────────── (a) bold muda a quebra ─────────────

describe('fontkit measurer — runs change the measured width', () => {
  const RUNS = [run('Receita '), run('subiu', 'bold'), run(' 14%')];
  const CONTENT = contentOf(RUNS);

  it('the bold version is wider than the all-regular one', () => {
    const regular = fontkitExact({ content: CONTENT, style: style(), maxWidth: Infinity });
    const rich = measureRuns(fontkitExact, RUNS, Infinity);
    expect(rich.width).toBeGreaterThan(regular.width + 0.5);
  });

  it('width = Σ parts measured each with its own face (space belongs to its run)', () => {
    const expected =
      widthIn(REGULAR, 'Receita', SIZE) +
      widthIn(REGULAR, ' ', SIZE) +
      widthIn(BOLD, 'subiu', SIZE) +
      widthIn(REGULAR, ' ', SIZE) +
      widthIn(REGULAR, '14%', SIZE);
    expect(measureRuns(fontkitExact, RUNS, Infinity).width).toBeCloseTo(expected, 1);
  });

  it('at a width where only the regular version fits, the break changes', () => {
    const regular = fontkitExact({ content: CONTENT, style: style(), maxWidth: Infinity }).width;
    const rich = measureRuns(fontkitExact, RUNS, Infinity).width;
    const maxWidth = (regular + rich) / 2;
    const plain = fontkitExact({ content: CONTENT, style: style(), maxWidth });
    const bold = measureRuns(fontkitExact, RUNS, maxWidth);
    expect(plain.lines).toEqual([CONTENT]);
    expect(bold.lines).toEqual(['Receita subiu', '14%']);
    expect(bold.lineRuns).toEqual([
      [
        { text: 'Receita ', run: 0 },
        { text: 'subiu', run: 1 },
      ],
      [{ text: '14%', run: 2 }],
    ]);
  });

  it('a segment crossing a run boundary sums its parts (widestSegment too)', () => {
    const runs = [run('sub'), run('iu', 'bold')];
    const r = measureRuns(fontkitExact, runs, Infinity);
    const expected = widthIn(REGULAR, 'sub', SIZE) + widthIn(BOLD, 'iu', SIZE);
    expect(r.width).toBeCloseTo(expected, 1);
    expect(r.widestSegment).toBeCloseTo(expected, 1);
    expect(r.lineRuns).toEqual([
      [
        { text: 'sub', run: 0 },
        { text: 'iu', run: 1 },
      ],
    ]);
  });

  it('kerning does not cross a run boundary', () => {
    const r = measureRuns(fontkitExact, [run('A'), run('V')], Infinity);
    expect(r.width).toBeCloseTo(widthIn(REGULAR, 'A', SIZE) + widthIn(REGULAR, 'V', SIZE), 1);
  });

  it('lineHeight/ascent come from the Text face, not from the runs', () => {
    const plain = fontkitExact({ content: CONTENT, style: style(), maxWidth: Infinity });
    const rich = measureRuns(fontkitExact, RUNS, Infinity);
    expect(rich.lineHeight).toBeCloseTo(plain.lineHeight, 6);
    expect(rich.ascent).toBeCloseTo(plain.ascent, 6);
  });

  it('without runs: one implicit run (index 0) with the style weight/italic', () => {
    const r = fontkitExact({ content: 'um dois\ntrês', style: style({ weight: 'bold' }), maxWidth: Infinity });
    expect(r.lineRuns).toEqual([[{ text: 'um dois', run: 0 }], [{ text: 'três', run: 0 }]]);
    expect(r.width).toBeCloseTo(widthIn(BOLD, 'um', SIZE) + widthIn(BOLD, ' ', SIZE) + widthIn(BOLD, 'dois', SIZE), 1);
  });

  // M13: só família ausente é fontMissing; peso ausente usa a face mais próxima.
  it('a run whose weight has no face uses the nearest one (faces[] records the request)', () => {
    const regularOnly = createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS.filter((f) => f.weight === 'regular')));
    const r = measureRuns(regularOnly, [run('a '), run('b', 'bold')], Infinity);
    expect(r.fontMissing).toBe(false);
    expect(r.faces?.map((face) => face.requested)).toEqual([undefined, 700]);
  });

  it('an empty line has lineRuns []', () => {
    const r = measureRuns(fontkitExact, [run('a\n\n'), run('b', 'bold')], Infinity);
    expect(r.lines).toEqual(['a', '', 'b']);
    expect(r.lineRuns).toEqual([[{ text: 'a', run: 0 }], [], [{ text: 'b', run: 1 }]]);
  });
});

// ───────────── (c) reticência ─────────────

describe('measurers — the ellipsis belongs to the last run of the line', () => {
  const cases = [
    { name: 'fontkit', m: fontkitExact },
    { name: 'estimate', m: estimate },
  ] as const;

  it.each(cases)('$name: truncated line ending inside a bold run', ({ m }) => {
    const runs = [run('aaa bbb '), run('ccc ddd eee fff ggg', 'bold')];
    const r = measureRuns(m, runs, 80, { maxLines: 2 });
    expect(r.truncated).toBe(true);
    expectCoherent(r, runs.length);
    const last = r.lineRuns.at(-1)!.at(-1)!;
    expect(last.text.endsWith('…')).toBe(true);
    expect(last.run).toBe(1);
    expect(r.lineRuns.flat().filter((p) => p.text.includes('…'))).toHaveLength(1);
  });

  it.each(cases)('$name: truncated line ending inside the first run', ({ m }) => {
    const runs = [run('aaa bbb ccc ddd eee '), run('fff', 'bold')];
    const r = measureRuns(m, runs, 80, { maxLines: 1 });
    expect(r.truncated).toBe(true);
    expectCoherent(r, runs.length);
    const last = r.lineRuns.at(-1)!.at(-1)!;
    expect(last.text.endsWith('…')).toBe(true);
    expect(last.run).toBe(0);
  });
});

// ───────────── (b) propriedade ─────────────

/** PRNG determinístico (mulberry32) — falhas reproduzíveis pela seed. */
const prng = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Rand = () => number;
const intIn = (rand: Rand, min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(rand: Rand, items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;

const LETTERS = 'abcdefghijklmnopqrstuvwxyzÁÉçãõ0123456789%$,.WMil';
const SEPARATORS = [' ', ' ', ' ', ' ', '  ', '\n', '-', '/', ' ', '\n\n'] as const;

const randomWord = (rand: Rand): string =>
  Array.from({ length: intIn(rand, 1, rand() < 0.1 ? 25 : 8) }, () => pick(rand, [...LETTERS])).join('');

const randomContent = (rand: Rand): string => {
  const words = Array.from({ length: intIn(rand, 0, 14) }, () => randomWord(rand));
  return words.map((w, i) => (i === 0 ? w : pick(rand, SEPARATORS) + w)).join('');
};

/** Corta o conteúdo em runs com estilos aleatórios (cortes podem cair em espaço, '\n' ou no meio da palavra). */
const randomRuns = (rand: Rand, content: string): readonly TextRun[] => {
  if (content === '') return [];
  const cuts = [...new Set(Array.from({ length: intIn(rand, 0, 4) }, () => intIn(rand, 1, content.length - 1)))]
    .filter((c) => c > 0 && c < content.length)
    .sort((x, y) => x - y);
  const bounds = [0, ...cuts, content.length];
  return bounds.slice(1).map((end, i) =>
    run(content.slice(bounds[i], end), rand() < 0.5 ? 'bold' : 'regular', rand() < 0.3, pick(rand, ['#000000', '#2F6FED'])),
  );
};

const CASES = 200;

describe.each([
  { name: 'fontkit', m: createFontkitMeasurer(registry) },
  { name: 'estimate', m: estimate },
])('$name measurer — lineRuns property (seed fixa, 200 casos)', ({ m }) => {
  it('lineRuns[i] joins to lines[i] and paragraphs.flat() === lines', () => {
    const rand = prng(0x5eed);
    for (let i = 0; i < CASES; i++) {
      const content = randomContent(rand);
      const runs = randomRuns(rand, content);
      const input: TextMeasureInput = {
        content,
        runs,
        style: style({ size: pick(rand, [10, 14, 20, 32]) }),
        maxWidth: rand() < 0.1 ? Infinity : intIn(rand, 15, 400),
        ...(rand() < 0.4 ? { maxLines: intIn(rand, 1, 5) } : {}),
        ...(rand() < 0.15 ? { nowrap: true } : {}),
      };
      const r = m(input);
      try {
        expectCoherent(r, runs.length);
      } catch (error) {
        throw new Error(`case ${i}: ${JSON.stringify(input)}\n${String(error)}`);
      }
    }
  });
});

// ───────────── (d) estimador ─────────────

describe('estimate measurer — same rules with runs', () => {
  it('bold has the same width as regular (no break change)', () => {
    const runs = [run('Receita '), run('subiu', 'bold'), run(' 14%')];
    const plain = estimate({ content: contentOf(runs), style: style(), maxWidth: 120 });
    const rich = measureRuns(estimate, runs, 120);
    expect(rich.lines).toEqual(plain.lines);
    expect(rich.width).toBeCloseTo(plain.width, 6);
    expectCoherent(rich, runs.length);
  });

  it('splits each line by run', () => {
    const runs = [run('ab '), run('cd ef', 'bold'), run(' gh')];
    // 0.5 × 20 = 10 pt por caractere: "ab cd" = 50 pt cabe; "ab cd ef" = 80 pt não.
    const r = measureRuns(estimate, runs, 55);
    expect(r.lines).toEqual(['ab cd', 'ef gh']);
    expect(r.lineRuns).toEqual([
      [
        { text: 'ab ', run: 0 },
        { text: 'cd', run: 1 },
      ],
      [
        { text: 'ef', run: 1 },
        { text: ' gh', run: 2 },
      ],
    ]);
  });

  it('without runs: one implicit run 0', () => {
    expect(estimate({ content: 'x y', style: style(), maxWidth: Infinity }).lineRuns).toEqual([[{ text: 'x y', run: 0 }]]);
  });
});
