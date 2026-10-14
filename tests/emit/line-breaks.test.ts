import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx, type EmitOptions } from '../../src/emit/index.ts';
import type { LineBreaks, TextLayout } from '../../src/core/types.ts';
import { fakeParagraphLayout, pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

/**
 * lineBreaks (M7-C): 'forced' (padrão) une as linhas de um parágrafo com <a:br/>;
 * 'auto' emite um <a:p> por parágrafo do autor, sem <a:br/>, com o TEXTO ORIGINAL do autor
 * (espaços normalizados); só um texto truncado usa as linhas calculadas unidas (com a reticência).
 */
type Paragraphs = readonly (readonly string[])[];

/** Conteúdo do autor coerente com as linhas falsas: cada parágrafo é suas linhas unidas por espaço. */
const contentOf = (paragraphs: Paragraphs): string => paragraphs.map((lines) => lines.join(' ')).join('\n');

const slideXml = async (text: TextLayout, lineBreaks?: LineBreaks, content = contentOf(text.paragraphs)): Promise<string> => {
  const node = pText(rect(10, 10, 300, 200), content, { lineHeight: 1.2 }, text);
  const options: EmitOptions = lineBreaks === undefined ? { baseDir: tmpdir() } : { baseDir: tmpdir(), lineBreaks };
  const buffer = await emitPptx(pDeck([pSlide([node])]), options);
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('ppt/slides/slide1.xml')!.async('string');
};

const BR = /<a:br\b[^>]*\/>|<a:br\b[^>]*>[\s\S]*?<\/a:br>/g;
const paragraphsOf = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g) ?? [];
const brCount = (fragment: string): number => (fragment.match(BR) ?? []).length;
const runCount = (p: string): number => (p.match(/<a:r>/g) ?? []).length;
const textOf = (fragment: string): string =>
  [...fragment.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t\/>/g)].map((m) => m[1] ?? '').join('');

const TWO_PARAGRAPHS = [
  ['first line of one', 'second line of one', 'third'],
  ['para two a', 'para two b'],
] as const;

const autoTexts = async (paragraphs: Paragraphs, content?: string): Promise<string[]> => {
  const xml = await slideXml(fakeParagraphLayout(paragraphs.map((p) => [...p])), 'auto', content);
  expect(brCount(xml)).toBe(0);
  return paragraphsOf(xml).map(textOf);
};

describe("emit lineBreaks: 'auto'", () => {
  it('no <a:br/> anywhere and one <a:p> per author paragraph', async () => {
    const xml = await slideXml(fakeParagraphLayout(TWO_PARAGRAPHS), 'auto');
    expect(brCount(xml)).toBe(0);
    expect(paragraphsOf(xml)).toHaveLength(2);
  });

  it('each paragraph is a single run with the whole paragraph text', async () => {
    const xml = await slideXml(fakeParagraphLayout(TWO_PARAGRAPHS), 'auto');
    const ps = paragraphsOf(xml);
    expect(ps.map(textOf)).toEqual(['first line of one second line of one third', 'para two a para two b']);
    expect(ps.map(runCount)).toEqual([1, 1]);
  });

  it("uses the author's text, not the computed lines", async () => {
    expect(await autoTexts([['computed', 'lines']], 'Texto ORIGINAL do autor')).toEqual(['Texto ORIGINAL do autor']);
  });

  it('normalizes repeated spaces inside the paragraph', async () => {
    expect(await autoTexts([['a b', 'c']], 'a   b  c')).toEqual(['a b c']);
  });

  it("URL broken at the slash comes out whole (no space after '/')", async () => {
    expect(await autoTexts([['exemplo.com/', 'a/', 'b']], 'exemplo.com/a/b')).toEqual(['exemplo.com/a/b']);
  });

  it("word broken at the hyphen comes out whole (no space after '-')", async () => {
    expect(await autoTexts([['texto bem-', 'vindo aqui']], 'texto bem-vindo aqui')).toEqual(['texto bem-vindo aqui']);
  });

  it('word broken by character (wordBroken) comes out whole', async () => {
    expect(await autoTexts([['Supercali', 'fragilístico', 'fim']], 'Supercalifragilístico fim')).toEqual([
      'Supercalifragilístico fim',
    ]);
  });

  it("' - ' between spaces keeps its spaces even when a line ends in '-'", async () => {
    expect(await autoTexts([['x a -', 'b'], ['outro']], 'x a - b\noutro')).toEqual(['x a - b', 'outro']);
  });

  it('mixed separators in one paragraph', async () => {
    const content = 'veja exemplo.com/a/b e pré-requisito';
    expect(await autoTexts([['veja', 'exemplo.com/', 'a/b e', 'pré-', 'requisito']], content)).toEqual([content]);
  });

  it.each([
    ['middle', [['a'], [''], ['b']], 'a\n\nb', ['a', '', 'b']],
    ['middle, no lines', [['a'], [], ['b']], 'a\n\nb', ['a', '', 'b']],
    ['leading', [[''], ['x']], '\nx', ['', 'x']],
    ['trailing', [['x'], ['']], 'x\n', ['x', '']],
    ['several in a row', [['a'], [''], [''], ['b']], 'a\n\n\nb', ['a', '', '', 'b']],
  ] as const)('empty paragraph (%s) still becomes its own <a:p> (occupies a line)', async (_case, paragraphs, content, texts) => {
    const xml = await slideXml(fakeParagraphLayout(paragraphs.map((p) => [...p])), 'auto', content);
    const ps = paragraphsOf(xml);
    expect(brCount(xml)).toBe(0);
    expect(ps.map(textOf)).toEqual([...texts]);
    // O <a:p> vazio mantém o espaçamento de linha, senão ocuparia outra altura.
    for (const p of ps) expect(p).toMatch(/<a:lnSpc>/);
  });

  it('truncated: the computed lines joined (with the ellipsis), not the original text', async () => {
    const text = fakeParagraphLayout([['one'], ['two a', 'two b…']], 18, true);
    const xml = await slideXml(text, 'auto', 'one\ntwo a two b two c\nthree');
    expect(brCount(xml)).toBe(0);
    expect(paragraphsOf(xml).map(textOf)).toEqual(['one', 'two a two b…']);
    expect(xml).not.toContain('two c');
    expect(xml).not.toContain('three');
  });

  it("truncated: the join still has no space after '/'", async () => {
    const text = fakeParagraphLayout([['veja exemplo.com/', 'a/b…']], 18, true);
    const xml = await slideXml(text, 'auto', 'veja exemplo.com/a/b e mais texto');
    expect(paragraphsOf(xml).map(textOf)).toEqual(['veja exemplo.com/a/b…']);
  });

  it('keeps wrap on (bodyPr is not wrap="none")', async () => {
    const xml = await slideXml(fakeParagraphLayout(TWO_PARAGRAPHS), 'auto');
    expect(xml).toMatch(/<a:bodyPr\b/);
    expect(xml).not.toMatch(/<a:bodyPr\b[^>]*wrap="none"/);
  });
});

describe("emit lineBreaks: 'forced' and default", () => {
  it.each([['forced' as const], [undefined]])('%s → <a:br/> between the lines of a paragraph', async (lineBreaks) => {
    const xml = await slideXml(fakeParagraphLayout(TWO_PARAGRAPHS), lineBreaks);
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(2);
    expect(ps.map(brCount)).toEqual([2, 1]);
    expect(ps.map(textOf)).toEqual(TWO_PARAGRAPHS.map((p) => p.join('')));
  });

  it('forced emits the computed lines, not the original text', async () => {
    const xml = await slideXml(fakeParagraphLayout([['computed', 'lines']]), 'forced', 'Texto ORIGINAL');
    expect(xml).not.toContain('ORIGINAL');
  });

  it('forced with one line per paragraph has no <a:br/>', async () => {
    expect(brCount(await slideXml(fakeParagraphLayout([['a'], ['b']]), 'forced'))).toBe(0);
  });
});
