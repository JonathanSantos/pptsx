import { describe, expect, it } from 'vitest';
import { slideToSvg, type SvgOptions } from '../../src/preview/index.ts';
import type { LineRun, PositionedNode, TextLayout, TextRun } from '../../src/core/types.ts';
import { SIZE_16X9, fakeParagraphLayout, pSlide, pText, rect } from '../helpers/nodes.ts';
import { findElements, isRed, styleOf, textOf, type SvgElement } from '../helpers/svg.ts';

/**
 * M8-E (preview): um <text> por linha com um <tspan> por run (font-weight,
 * font-style, fill, xml:space="preserve"); Text com fontMissing não recebe o
 * realce de estouro no debug.
 */

const options = (over: Partial<SvgOptions> = {}): SvgOptions => ({
  widthPx: 1280,
  baseDir: '/base',
  readFile: () => Buffer.alloc(0),
  ...over,
});

const svgOf = (children: readonly PositionedNode[], over: Partial<SvgOptions> = {}) =>
  slideToSvg(pSlide(children), SIZE_16X9, options(over));

const run = (text: string, over: Partial<Omit<TextRun, 'text'>> = {}): TextRun => ({
  text,
  weight: 'regular',
  italic: false,
  color: '#000000',
  ...over,
});

const RUNS: readonly TextRun[] = [
  run('Receita '),
  run('subiu', { weight: 'bold' }),
  run(' 14%', { italic: true, color: '#2F6FED' }),
];

const layoutWith = (
  paragraphs: readonly (readonly string[])[],
  lineRuns: readonly (readonly LineRun[])[],
  over: Partial<TextLayout> = {},
): TextLayout => ({ ...fakeParagraphLayout(paragraphs), lineRuns, ...over });

const richNode = (lines: readonly (readonly LineRun[])[], over: Partial<TextLayout> = {}) =>
  pText(
    rect(50, 100, 400, 60),
    'Receita subiu 14%',
    {},
    layoutWith([lines.map((parts) => parts.map((p) => p.text).join(''))], lines, over),
    RUNS,
  );

const ONE_LINE: readonly (readonly LineRun[])[] = [
  [
    { text: 'Receita ', run: 0 },
    { text: 'subiu', run: 1 },
    { text: ' 14%', run: 2 },
  ],
];

const weightOf = (el: SvgElement): string => styleOf(el, 'font-weight') ?? 'normal';
const isBoldWeight = (value: string): boolean => /^(bold|[6-9]00)$/.test(value);
const styleNameOf = (el: SvgElement): string => styleOf(el, 'font-style') ?? 'normal';

describe('slideToSvg — one <tspan> per run', () => {
  it('three runs in a line → one <text> with three <tspan>', () => {
    const texts = findElements(svgOf([richNode(ONE_LINE)]), 'text');
    expect(texts).toHaveLength(1);
    const spans = findElements(texts[0]!.inner, 'tspan');
    expect(spans.map(textOf)).toEqual(['Receita ', 'subiu', ' 14%']);
    expect(textOf(texts[0]!)).toBe('Receita subiu 14%');
  });

  it('font-weight per run', () => {
    const [t] = findElements(svgOf([richNode(ONE_LINE)]), 'text');
    const spans = findElements(t!.inner, 'tspan');
    expect(spans.map((s) => isBoldWeight(weightOf(s)))).toEqual([false, true, false]);
  });

  it('font-style per run', () => {
    const [t] = findElements(svgOf([richNode(ONE_LINE)]), 'text');
    expect(findElements(t!.inner, 'tspan').map((s) => styleNameOf(s) === 'italic')).toEqual([false, false, true]);
  });

  it('fill per run', () => {
    const [t] = findElements(svgOf([richNode(ONE_LINE)]), 'text');
    expect(findElements(t!.inner, 'tspan').map((s) => styleOf(s, 'fill')?.toUpperCase())).toEqual([
      '#000000',
      '#000000',
      '#2F6FED',
    ]);
  });

  it('preserves spaces at the run boundaries (xml:space="preserve")', () => {
    const [t] = findElements(svgOf([richNode(ONE_LINE)]), 'text');
    const spans = findElements(t!.inner, 'tspan');
    const preserved = (el: SvgElement) => el.attrs['xml:space'] === 'preserve';
    expect(preserved(t!) || spans.every(preserved)).toBe(true);
  });

  it('one <text> per line, each with the tspans of its runs', () => {
    const lines: readonly (readonly LineRun[])[] = [
      [
        { text: 'Receita ', run: 0 },
        { text: 'subiu', run: 1 },
      ],
      [{ text: '14%', run: 2 }],
    ];
    const texts = findElements(svgOf([richNode(lines)]), 'text');
    expect(texts.map(textOf)).toEqual(['Receita subiu', '14%']);
    expect(texts.map((t) => findElements(t.inner, 'tspan').map(textOf))).toEqual([['Receita ', 'subiu'], ['14%']]);
  });

  it('maps the family through fontFamilyMap', () => {
    const svg = svgOf([richNode(ONE_LINE)], { fontFamilyMap: { Arial: 'Liberation Sans' } });
    const [t] = findElements(svg, 'text');
    const families = [t!, ...findElements(t!.inner, 'tspan')].map((el) => styleOf(el, 'font-family')).filter(Boolean);
    expect(families.length).toBeGreaterThan(0);
    families.forEach((f) => expect(f).toMatch(/Liberation Sans/));
  });

  it('escapes XML inside the tspans', () => {
    const node = pText(
      rect(0, 0, 300, 40),
      'a<b & c',
      {},
      layoutWith([['a<b & c']], [[{ text: 'a<b', run: 0 }, { text: ' & c', run: 1 }]]),
      [run('a<b'), run(' & c', { weight: 'bold' })],
    );
    const svg = svgOf([node]);
    expect(svg).toContain('a&lt;b');
    expect(svg).toContain('&amp; c');
  });
});

describe('slideToSvg debug — fontMissing has no overflow highlight', () => {
  // 5 linhas × 20 pt = 100 pt numa caixa de 40 pt: estoura, mas a medição foi estimada.
  const lines = Array.from({ length: 5 }, (_, i) => [{ text: `linha ${i}`, run: 0 }]);
  const node = (fontMissing: boolean) =>
    pText(
      rect(50, 50, 200, 40),
      'x',
      {},
      layoutWith([lines.map((l) => l[0]!.text)], lines, { fontMissing }),
      [run('x')],
    );
  const redFills = (svg: string) => findElements(svg, 'rect').filter((r) => isRed(styleOf(r, 'fill')));

  it('control: the same overflow without fontMissing is highlighted', () => {
    expect(redFills(svgOf([node(false)], { debug: true })).length).toBeGreaterThan(0);
  });

  it('with fontMissing no red band is drawn', () => {
    expect(redFills(svgOf([node(true)], { debug: true }))).toEqual([]);
  });
});
