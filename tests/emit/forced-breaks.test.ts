import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx } from '../../src/emit/index.ts';
import type { TextLayout } from '../../src/core/types.ts';
import { fakeParagraphLayout, pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

/**
 * Quebra forçada (M3-H): cada parágrafo de text.paragraphs vira um <a:p>; as
 * linhas dentro dele são unidas por <a:br/>; lnSpc em todos os <a:p>; o texto
 * emitido são as linhas calculadas, não o content original.
 */
const slideXml = async (content: string, text: TextLayout): Promise<string> => {
  const node = pText(rect(10, 10, 300, 200), content, { lineHeight: 1.2 }, text);
  const buffer = await emitPptx(pDeck([pSlide([node])]), { baseDir: tmpdir() });
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('ppt/slides/slide1.xml')!.async('string');
};

const paragraphsOf = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g) ?? [];
const brCount = (p: string): number => (p.match(/<a:br\b[^>]*\/>|<a:br\b[^>]*>[\s\S]*?<\/a:br>/g) ?? []).length;
const textOf = (fragment: string): string =>
  [...fragment.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t\/>/g)].map((m) => m[1] ?? '').join('');
/** Texto de cada linha de um <a:p>, separando pelas quebras suaves. */
const linesOf = (p: string): string[] => p.split(/<a:br\b[^>]*\/>|<a:br\b[^>]*>[\s\S]*?<\/a:br>/).map(textOf);

const TWO_PARAGRAPHS = [
  ['first line of one', 'second line of one', 'third'],
  ['para two a', 'para two b'],
] as const;

describe('emit forced breaks — paragraphs and soft breaks', () => {
  it('one <a:p> per paragraph', async () => {
    const xml = await slideXml('ignored', fakeParagraphLayout(TWO_PARAGRAPHS));
    expect(paragraphsOf(xml)).toHaveLength(2);
  });

  it('<a:br/> count per <a:p> = lines − 1', async () => {
    const ps = paragraphsOf(await slideXml('ignored', fakeParagraphLayout(TWO_PARAGRAPHS)));
    expect(ps.map(brCount)).toEqual([2, 1]);
  });

  it('the text of each <a:p> is its lines, in order', async () => {
    const ps = paragraphsOf(await slideXml('ignored', fakeParagraphLayout(TWO_PARAGRAPHS)));
    expect(ps.map(linesOf)).toEqual(TWO_PARAGRAPHS.map((p) => [...p]));
    expect(ps.map(textOf)).toEqual(TWO_PARAGRAPHS.map((p) => p.join('')));
  });

  it('a single-line paragraph has no <a:br/>', async () => {
    const ps = paragraphsOf(await slideXml('x', fakeParagraphLayout([['only']])));
    expect(ps).toHaveLength(1);
    expect(brCount(ps[0]!)).toBe(0);
    expect(textOf(ps[0]!)).toBe('only');
  });

  it('an empty paragraph becomes an <a:p> without text', async () => {
    const ps = paragraphsOf(await slideXml('a\n\nb', fakeParagraphLayout([['a'], [''], ['b']])));
    expect(ps).toHaveLength(3);
    expect(ps.map(textOf)).toEqual(['a', '', 'b']);
    expect(brCount(ps[1]!)).toBe(0);
  });

  it('lnSpc is present in every <a:p>', async () => {
    const ps = paragraphsOf(
      await slideXml('ignored', fakeParagraphLayout([...TWO_PARAGRAPHS.map((p) => [...p]), [''], ['tail']])),
    );
    expect(ps).toHaveLength(4);
    for (const p of ps) expect(p).toMatch(/<a:lnSpc>[\s\S]*?<\/a:lnSpc>/);
  });

  it('emits the computed lines, not the original content', async () => {
    const xml = await slideXml('ORIGINALCONTENT here', fakeParagraphLayout([['computed', 'lines']]));
    expect(xml).not.toContain('ORIGINALCONTENT');
    expect(paragraphsOf(xml).map(linesOf)).toEqual([['computed', 'lines']]);
  });

  it('truncated: emits only the visible lines from paragraphs', async () => {
    const text = fakeParagraphLayout([['aaa bbb', 'ccc ddd…']], 18, true);
    const xml = await slideXml('aaa bbb ccc ddd eee\nfff', text);
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(1);
    expect(linesOf(ps[0]!)).toEqual(['aaa bbb', 'ccc ddd…']);
    expect(xml).not.toContain('eee');
    expect(xml).not.toContain('fff');
  });

  it('truncated across paragraphs: earlier paragraphs whole, last with remaining lines', async () => {
    const text = fakeParagraphLayout([['one'], ['two a', 'two b…']], 18, true);
    const ps = paragraphsOf(await slideXml('one\ntwo a two b two c\nthree', text));
    expect(ps.map(linesOf)).toEqual([['one'], ['two a', 'two b…']]);
  });
});
