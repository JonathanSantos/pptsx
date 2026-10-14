import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx } from '../../src/emit/index.ts';
import type { LineBreaks, LineRun, TextLayout, TextRun } from '../../src/core/types.ts';
import { fakeParagraphLayout, pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

/**
 * M8-E: um <a:r> por LineRun em cada linha, com bold/italic/cor do run;
 * <a:br/> só entre linhas do mesmo parágrafo. 'auto': um <a:r> por TextRun por
 * parágrafo (runs que cruzam '\n' são divididos).
 */

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
const CONTENT = RUNS.map((r) => r.text).join('');

/** Layout com parágrafos e lineRuns explícitos (lines = paragraphs.flat()). */
const layoutWith = (paragraphs: readonly (readonly string[])[], lineRuns: readonly (readonly LineRun[])[]): TextLayout => ({
  ...fakeParagraphLayout(paragraphs),
  lineRuns,
});

const slideXml = async (
  content: string,
  runs: readonly TextRun[],
  text: TextLayout,
  lineBreaks?: LineBreaks,
): Promise<string> => {
  const node = pText(rect(10, 10, 400, 200), content, {}, text, runs);
  const buffer = await emitPptx(pDeck([pSlide([node])]), {
    baseDir: tmpdir(),
    ...(lineBreaks === undefined ? {} : { lineBreaks }),
  });
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('ppt/slides/slide1.xml')!.async('string');
};

interface XmlRun {
  readonly props: string;
  readonly text: string;
}

const BR = /<a:br\b[^>]*\/>|<a:br\b[^>]*>[\s\S]*?<\/a:br>/;
const paragraphsOf = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g) ?? [];
const runsOf = (fragment: string): XmlRun[] =>
  [...fragment.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map((m) => {
    const body = m[1] ?? '';
    const props = /<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/.exec(body)?.[0] ?? '';
    const text = /<a:t>([\s\S]*?)<\/a:t>/.exec(body)?.[1] ?? '';
    return { props, text };
  });
/** Linhas de um <a:p> (separadas por <a:br/>), cada uma com seus runs. */
const linesOf = (p: string): XmlRun[][] => p.split(BR).map(runsOf);

const isBold = (r: XmlRun): boolean => /\bb="1"/.test(r.props);
const isItalic = (r: XmlRun): boolean => /\bi="1"/.test(r.props);
const colorOf = (r: XmlRun): string | undefined => /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(r.props)?.[1]?.toUpperCase();

describe("emit runs — lineBreaks 'forced'", () => {
  const oneLine = () =>
    slideXml(
      CONTENT,
      RUNS,
      layoutWith(
        [[CONTENT]],
        [
          [
            { text: 'Receita ', run: 0 },
            { text: 'subiu', run: 1 },
            { text: ' 14%', run: 2 },
          ],
        ],
      ),
    );

  it('three <a:r> in the line, in order', async () => {
    const [p] = paragraphsOf(await oneLine());
    expect(runsOf(p!).map((r) => r.text)).toEqual(['Receita ', 'subiu', ' 14%']);
  });

  it('b="1" only on the middle run', async () => {
    const [p] = paragraphsOf(await oneLine());
    expect(runsOf(p!).map(isBold)).toEqual([false, true, false]);
  });

  it('i="1" only where italic', async () => {
    const [p] = paragraphsOf(await oneLine());
    expect(runsOf(p!).map(isItalic)).toEqual([false, false, true]);
  });

  it('color per run', async () => {
    const [p] = paragraphsOf(await oneLine());
    expect(runsOf(p!).map(colorOf)).toEqual(['000000', '000000', '2F6FED']);
  });

  it('a run split across lines: <a:br/> only between lines, runs per line', async () => {
    const xml = await slideXml(
      CONTENT,
      RUNS,
      layoutWith(
        [['Receita subiu', '14%']],
        [
          [
            { text: 'Receita ', run: 0 },
            { text: 'subiu', run: 1 },
          ],
          [{ text: '14%', run: 2 }],
        ],
      ),
    );
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(1);
    const lines = linesOf(ps[0]!);
    expect(lines.map((l) => l.map((r) => r.text))).toEqual([['Receita ', 'subiu'], ['14%']]);
    expect(lines.map((l) => l.map(isBold))).toEqual([[false, true], [false]]);
    expect(lines[1]!.map(isItalic)).toEqual([true]);
  });

  it('a bold run that spans two lines stays bold in both', async () => {
    const runs = [run('aaa '), run('bbb ccc', { weight: 'bold' })];
    const xml = await slideXml(
      'aaa bbb ccc',
      runs,
      layoutWith(
        [['aaa bbb', 'ccc']],
        [
          [
            { text: 'aaa ', run: 0 },
            { text: 'bbb', run: 1 },
          ],
          [{ text: 'ccc', run: 1 }],
        ],
      ),
    );
    const lines = linesOf(paragraphsOf(xml)[0]!);
    expect(lines.map((l) => l.map(isBold))).toEqual([[false, true], [true]]);
  });

  it('paragraphs: one <a:p> each, runs kept per paragraph', async () => {
    const runs = [run('um '), run('dois', { weight: 'bold' }), run('\ntrês')];
    const xml = await slideXml(
      'um dois\ntrês',
      runs,
      layoutWith(
        [['um dois'], ['três']],
        [
          [
            { text: 'um ', run: 0 },
            { text: 'dois', run: 1 },
          ],
          [{ text: 'três', run: 2 }],
        ],
      ),
    );
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(2);
    expect(ps.map((p) => p.match(BR))).toEqual([null, null]);
    expect(runsOf(ps[0]!).map(isBold)).toEqual([false, true]);
    expect(runsOf(ps[1]!).map((r) => r.text)).toEqual(['três']);
  });

  it('a Text without Span still emits one run per line with the Text style', async () => {
    const xml = await slideXml(
      'abc',
      [run('abc', { weight: 'bold' })],
      layoutWith([['abc']], [[{ text: 'abc', run: 0 }]]),
    );
    const runs = runsOf(paragraphsOf(xml)[0]!);
    expect(runs).toHaveLength(1);
    expect(isBold(runs[0]!)).toBe(true);
  });
});

describe("emit runs — lineBreaks 'auto'", () => {
  it('one <a:r> per TextRun per paragraph, author text, no <a:br/>', async () => {
    const xml = await slideXml(
      CONTENT,
      RUNS,
      layoutWith(
        [['Receita subiu', '14%']],
        [
          [
            { text: 'Receita ', run: 0 },
            { text: 'subiu', run: 1 },
          ],
          [{ text: '14%', run: 2 }],
        ],
      ),
      'auto',
    );
    expect(xml).not.toMatch(BR);
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(1);
    const runs = runsOf(ps[0]!);
    expect(runs.map((r) => r.text).join('')).toBe('Receita subiu 14%');
    expect(runs).toHaveLength(3);
    expect(runs.map(isBold)).toEqual([false, true, false]);
    expect(runs.map(isItalic)).toEqual([false, false, true]);
    expect(runs.map(colorOf)).toEqual(['000000', '000000', '2F6FED']);
  });

  it('a run crossing "\\n" is split between the paragraphs', async () => {
    const runs = [run('um '), run('dois\ntrês', { weight: 'bold' }), run(' quatro')];
    const xml = await slideXml(
      'um dois\ntrês quatro',
      runs,
      layoutWith(
        [['um dois'], ['três quatro']],
        [
          [
            { text: 'um ', run: 0 },
            { text: 'dois', run: 1 },
          ],
          [
            { text: 'três', run: 1 },
            { text: ' quatro', run: 2 },
          ],
        ],
      ),
      'auto',
    );
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(2);
    expect(ps.map((p) => runsOf(p).map((r) => r.text).join(''))).toEqual(['um dois', 'três quatro']);
    expect(ps.map((p) => runsOf(p).map(isBold))).toEqual([
      [false, true],
      [true, false],
    ]);
  });
});
