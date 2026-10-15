import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { isRichNotes, notesParagraphsOf } from '../../src/emit/notes.ts';
import { keywordsOf } from '../../src/emit/document.ts';
import { overviewLabelOf } from '../../src/preview/overview.ts';
import { B, Box, Deck, I, Slide, Span, Text } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import type { RenderOptions, SlideElement, TextRun } from '../../src/core/types.ts';

const open = async (deck: unknown, options: RenderOptions = {}) => {
  const [result] = await render(() => deck as SlideElement, { preview: false, includePositioned: true, ...options });
  const zip = await JSZip.loadAsync(result!.buffer);
  const read = async (name: string) => (await zip.file(name)?.async('string')) ?? '';
  return { zip, read, result: result! };
};

const sectionsOf = (presentation: string) =>
  [...presentation.matchAll(/<p14:section name="([^"]*)"[^>]*>([\s\S]*?)<\/p14:section>/g)].map(([, name, body]) => ({
    name,
    slides: [...body!.matchAll(/<p14:sldId id="(\d+)"/g)].map(([, id]) => Number(id) - 255),
  }));

const ITEMS = Array.from({ length: 14 }, (_, i) => <Text fontSize={28}>Item {i + 1}</Text>);

describe('M15-3 — seções', () => {
  it('seções do autor traduzidas depois da paginação; antes da 1ª, a seção padrão', async () => {
    const { read, result } = await open(
      <Deck sections={[{ title: 'Lista', from: 2 }, { title: 'Fim', from: 3 }]}>
        <Slide />
        <Slide padding={30}><Box paginate flex={1}>{ITEMS}</Box></Slide>
        <Slide />
      </Deck>,
    );
    const parts = result.positioned!.slides.length;
    expect(parts).toBeGreaterThan(3);
    expect(sectionsOf(await read('ppt/presentation.xml'))).toEqual([
      { name: 'Seção padrão', slides: [1] },
      { name: 'Lista', slides: Array.from({ length: parts - 2 }, (_, i) => i + 2) },
      { name: 'Fim', slides: [parts] },
    ]);
  });

  it('sem sections, sem sectionLst; título repetido → ResolveError', async () => {
    const { read } = await open(<Deck><Slide /></Deck>);
    expect(await read('ppt/presentation.xml')).not.toContain('sectionLst');
    await expect(open(<Deck sections={[{ title: 'A', from: 1 }, { title: 'A', from: 2 }]}><Slide /><Slide /></Deck>)).rejects.toThrow(/repete o título "A"/);
  });
});

describe('M15-3 — slide oculto', () => {
  it('<p:sld show="0"> só no oculto, em todas as partes de um paginado', async () => {
    const { read, result } = await open(
      <Deck>
        <Slide />
        <Slide hidden padding={30}><Box paginate flex={1}>{ITEMS}</Box></Slide>
      </Deck>,
    );
    const count = result.positioned!.slides.length;
    const shows = await Promise.all(Array.from({ length: count }, (_, i) => read(`ppt/slides/slide${i + 1}.xml`)));
    expect(shows.map((xml) => /<p:sld [^>]*show="0"/.test(xml))).toEqual([false, ...Array.from({ length: count - 1 }, () => true)]);
  });
});

const run = (text: string, extra: Partial<TextRun> = {}): TextRun => ({ text, weight: 'regular', italic: false, color: '#000000', ...extra });

describe('M15-3 — notas formatadas', () => {
  it('parágrafos por \\n e notas ricas só com estilo', () => {
    expect(notesParagraphsOf([run('a\nb'), run('c', { weight: 'bold' }), run('\n\nd')]).map((p) => p.map((r) => r.text))).toEqual([['a'], ['b', 'c'], [], ['d']]);
    expect(isRichNotes({ content: 'x', runs: [run('x')] })).toBe(false);
    expect(isRichNotes({ content: 'x', runs: [run('x', { italic: true })] })).toBe(true);
    expect(isRichNotes({ content: 'x', runs: [run('x', { href: 'slide:2' })] })).toBe(false);
  });

  it('negrito, itálico, cor e link externo no notesSlide; texto puro continua como o pptxgenjs grava', async () => {
    const { read } = await open(
      <Deck>
        <Slide notes={<>Abra com <B>a meta</B> e <I>respire</I>.{'\n'}Veja <Span color="#D64545" href="https://example.com/q3">o relatório</Span>.</>} />
        <Slide notes="Só texto." />
      </Deck>,
    );
    const rich = await read('ppt/notesSlides/notesSlide1.xml');
    expect(rich).toMatch(/<a:rPr lang="pt-BR" b="1" dirty="0"><\/a:rPr><a:t>a meta<\/a:t>/);
    expect(rich).toMatch(/<a:rPr lang="pt-BR" i="1" dirty="0"><\/a:rPr><a:t>respire<\/a:t>/);
    expect(rich).toContain('<a:solidFill><a:srgbClr val="D64545"/></a:solidFill><a:hlinkClick r:id="rIdNotesLink1"/>');
    expect(rich.match(/<a:p>/g)!.length).toBeGreaterThanOrEqual(2);
    expect(rich).toContain('<p:ph type="sldImg"/>');
    expect(await read('ppt/notesSlides/_rels/notesSlide1.xml.rels')).toContain('Id="rIdNotesLink1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/q3" TargetMode="External"');
    const plain = await read('ppt/notesSlides/notesSlide2.xml');
    expect(plain).toContain('<a:t>Só texto.</a:t>');
    expect(plain).not.toContain('b="1"');
  });
});

describe('M15-3 — propriedades do documento', () => {
  it('título, autor, empresa, assunto e palavras-chave', async () => {
    const { read } = await open(<Deck><Slide /></Deck>, {
      document: { title: 'Q3 & metas', author: 'Ana', company: 'ACME', subject: 'Resultados', keywords: ['q3', ' metas ', ''] },
    });
    const core = await read('docProps/core.xml');
    expect(core).toContain('<dc:title>Q3 &amp; metas</dc:title>');
    expect(core).toContain('<dc:creator>Ana</dc:creator>');
    expect(core).toContain('<dc:subject>Resultados</dc:subject>');
    expect(core).toContain('<cp:keywords>q3, metas</cp:keywords>');
    expect(await read('docProps/app.xml')).toContain('<Company>ACME</Company>');
    expect(keywordsOf('um')).toBe('um');
    expect(keywordsOf([])).toBeUndefined();
  });
});

describe('M15-3 — overview', () => {
  it('legenda com seção e oculto', () => {
    const png = Buffer.alloc(0);
    expect(overviewLabelOf({ png, number: 3 })).toBe('3');
    expect(overviewLabelOf({ png, number: 3, section: 'Resultados', hidden: true })).toBe('3 · Resultados · oculto');
    expect(overviewLabelOf({ png, number: 1, section: 'x'.repeat(60) })).toHaveLength(40);
  });
});
