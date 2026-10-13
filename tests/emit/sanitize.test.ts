import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx } from '../../src/emit/index.ts';
import { keepFirstParagraphProps } from '../../src/emit/sanitize.ts';
import { fakeParagraphLayout, pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

const PPR = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
const paragraphsOf = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [];
const pPrCount = (p: string): number => (p.match(PPR) ?? []).length;

const run = (t: string) => `<a:r><a:rPr lang="pt-BR"/><a:t>${t}</a:t></a:r>`;
const SELF_CLOSING = '<a:pPr algn="l" indent="0"/>';
const WITH_CHILDREN = '<a:pPr algn="l"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>';

describe('keepFirstParagraphProps', () => {
  it('keeps only the first self-closing <a:pPr> of an <a:p>', () => {
    const xml = `<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(`<a:p>${SELF_CLOSING}${run('a')}<a:br/>${run('b')}</a:p>`);
  });

  it('keeps only the first <a:pPr> with children', () => {
    const xml = `<a:p>${WITH_CHILDREN}${run('a')}<a:br/>${WITH_CHILDREN}${run('b')}<a:br/>${WITH_CHILDREN}${run('c')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(
      `<a:p>${WITH_CHILDREN}${run('a')}<a:br/>${run('b')}<a:br/>${run('c')}</a:p>`,
    );
  });

  it('leaves a paragraph with a single <a:pPr> untouched', () => {
    const xml = `<a:p>${WITH_CHILDREN}${run('only')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(xml);
  });

  it('leaves a paragraph without <a:pPr> untouched', () => {
    const xml = `<a:p>${run('x')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(xml);
  });

  it('works per paragraph: each <a:p> keeps its own first <a:pPr>', () => {
    const p1 = `<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}</a:p>`;
    const p2 = `<a:p>${WITH_CHILDREN}${run('c')}<a:br/>${WITH_CHILDREN}${run('d')}</a:p>`;
    const out = keepFirstParagraphProps(`<p:txBody>${p1}${p2}</p:txBody>`);
    const ps = paragraphsOf(out);
    expect(ps).toHaveLength(2);
    expect(ps.map(pPrCount)).toEqual([1, 1]);
    expect(ps[0]).toContain(SELF_CLOSING);
    expect(ps[1]).toContain(WITH_CHILDREN);
  });

  it('preserves <a:br/> and every run, in order', () => {
    const xml = `<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}<a:br/>${SELF_CLOSING}${run('c')}</a:p>`;
    const out = keepFirstParagraphProps(xml);
    expect(out.match(/<a:br\/>/g)).toHaveLength(2);
    expect([...out.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])).toEqual(['a', 'b', 'c']);
    expect(out.match(/<a:rPr lang="pt-BR"\/>/g)).toHaveLength(3);
  });

  it('does not touch content outside <a:p>', () => {
    const outside = '<a:bodyPr wrap="square"/><a:lstStyle/>';
    const xml = `${outside}<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}</a:p>`;
    expect(keepFirstParagraphProps(xml).startsWith(outside)).toBe(true);
  });
});

describe('emitPptx — at most one <a:pPr> per <a:p>', () => {
  it('multi-line, multi-paragraph text', async () => {
    const text = fakeParagraphLayout([
      ['primeira linha', 'segunda linha', 'terceira'],
      ['outro parágrafo', 'com duas'],
      ['único'],
    ]);
    const node = pText(rect(10, 10, 300, 200), 'ignored', { lineHeight: 1.2, align: 'center' }, text);
    const buffer = await emitPptx(pDeck([pSlide([node])]), { baseDir: tmpdir() });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(3);
    for (const p of ps) expect(pPrCount(p)).toBeLessThanOrEqual(1);
    expect(ps.map((p) => (p.match(/<a:br\b[^>]*\/>/g) ?? []).length)).toEqual([2, 1, 0]);
  });
});
