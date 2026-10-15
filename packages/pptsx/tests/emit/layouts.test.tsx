import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { explicitRunStyle, takeLastDrawings } from '../../src/emit/layouts.ts';
import { Box, Deck, Image, Slide, Text, defineLayout } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import type { Children, PositionedText, SlideElement } from '../../src/core/types.ts';

const open = async (deck: unknown) => {
  const [result] = await render(() => deck as SlideElement, { preview: false, includePositioned: true, baseDir: process.cwd() });
  const zip = await JSZip.loadAsync(result!.buffer);
  const read = async (name: string) => (await zip.file(name)?.async('string')) ?? '';
  const layouts = Object.keys(zip.files).filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).sort();
  const layoutNamed = async (name: string) => {
    const all = await Promise.all(layouts.map(async (part) => [part, await read(part)] as const));
    return all.find(([, xml]) => xml.includes(`<p:cSld name="${name}"`));
  };
  return { zip, read, layouts, layoutNamed, result: result! };
};

const EMU_PER_PT = 12700;
const xfrmOf = (xml: string) => {
  const [, x, y, cx, cy] = /<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml)!;
  return [x, y, cx, cy].map((value) => Number(value) / EMU_PER_PT);
};
const elementNamed = (xml: string, name: string) => (xml.match(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g) ?? []).find((element) => element.includes(`name="${name}"`));

const Content = defineLayout('Content', { placeholders: ['title', 'body', 'subtitle'], fixed: <Text position="absolute" left={20} bottom={10} fontSize={10}>Marca</Text> },
  ({ title, top = 30, children }: { title: string; top?: number; children?: Children }) => (
    <Slide padding={`${top} 30 30`} gap={10}>
      <Text placeholder="title" fontSize={28} fontWeight="bold" color="#1B2A4A">{title}</Text>
      <Text placeholder="subtitle" fontSize={14} fontStyle="italic">Sub</Text>
      <Box placeholder="body" flex={1}>{children}</Box>
    </Slide>
  ),
);

describe('M15-4 — layouts e placeholders', () => {
  const deck = (
    <Deck>
      <Content title="Primeiro"><Text>a</Text></Content>
      <Slide><Text>solto</Text></Slide>
      <Content title="Segundo" top={60}><Text>b</Text></Content>
    </Deck>
  );

  it('um slide layout por defineLayout, com <p:ph> no frame e no estilo do 1º uso', async () => {
    const { layoutNamed, result } = await open(deck);
    const [, layout] = (await layoutNamed('Content'))!;
    const title = elementNamed(layout, 'Título')!;
    expect(title).toContain('<p:ph type="title"/>');
    const node = result.positioned!.slides[0]!.children[0] as PositionedText;
    const content = { x: node.frame.x, y: node.frame.y, w: node.frame.width, h: node.frame.height };
    expect(xfrmOf(title).map((value) => Math.round(value))).toEqual([content.x, content.y, content.w, content.h].map((value) => Math.round(value)));
    expect(title).toMatch(/<a:defRPr sz="2800" b="1">/);
    expect(title).toContain('<a:noAutofit/>');
    const subtitle = elementNamed(layout, 'Subtítulo')!;
    expect(subtitle).toContain('<p:ph type="subTitle" idx="12"/>');
    expect(subtitle).toMatch(/<a:defRPr sz="1400" b="0" i="1">/);
    expect(elementNamed(layout, 'Conteúdo')).toContain('<p:ph type="body" idx="11"/>');
  });

  it('os slides do layout ligam o Text marcado ao placeholder e guardam o próprio xfrm; Box não liga; slide solto fica sem layout próprio', async () => {
    const { read, result } = await open(deck);
    const [first, solto, second] = await Promise.all([1, 2, 3].map((n) => read(`ppt/slides/slide${n}.xml`)));
    expect(elementNamed(first!, 'Título')).toContain('<p:ph type="title"/>');
    expect(elementNamed(first!, 'Título')).toContain('<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>');
    const secondTitle = elementNamed(second!, 'Título')!;
    const node = result.positioned!.slides[2]!.children[0] as PositionedText;
    expect(Math.round(xfrmOf(secondTitle)[1]!)).toBe(Math.round(node.frame.y));
    expect(second).not.toContain('idx="11"');
    expect(solto).not.toContain('<p:ph');
    expect(secondTitle).toMatch(/<a:rPr [^>]*b="1"[^>]*i="0"/);
    const rels = await Promise.all([1, 2, 3].map((n) => read(`ppt/slides/_rels/slide${n}.xml.rels`)));
    const layoutOf = (xml: string | undefined) => /Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/.exec(xml ?? '')![1];
    expect(layoutOf(rels[0])).toBe(layoutOf(rels[2]));
    expect(layoutOf(rels[1])).not.toBe(layoutOf(rels[0]));
  });

  it('o conteúdo fixo sai no layout e em nenhum slide', async () => {
    const { read, layoutNamed } = await open(deck);
    const [, layout] = (await layoutNamed('Content'))!;
    expect(layout).toContain('<a:t>Marca</a:t>');
    expect(layout).toMatch(/<p:cNvPr id="1000"/);
    const slides = await Promise.all([1, 2, 3].map((n) => read(`ppt/slides/slide${n}.xml`)));
    slides.forEach((xml) => expect(xml).not.toContain('Marca'));
  });

  it('imagem fixa: o relacionamento vai junto para o .rels do layout', async () => {
    const Logo = defineLayout('Logo', { placeholders: [], fixed: <Image src="examples/assets/chart.png" position="absolute" right={10} top={10} width={40} height={30} /> },
      () => <Slide><Text>x</Text></Slide>);
    const { read, layoutNamed } = await open(<Deck><Logo /><Logo /></Deck>);
    const [part, layout] = (await layoutNamed('Logo'))!;
    expect(layout).toMatch(/<a:blip r:embed="rIdFixed1"/);
    const rels = await read(part.replace(/([^/]+)$/, '_rels/$1.rels'));
    expect(rels).toMatch(/Id="rIdFixed1" Type="[^"]*\/image" Target="\.\.\/media\/[^"]+"/);
    expect(await read('ppt/slides/slide1.xml')).not.toContain('<p:pic>');
  });

  it('sem defineLayout, só o layout padrão do pptxgenjs e nenhum <p:ph>', async () => {
    const { layouts, read } = await open(<Deck><Slide><Text>x</Text></Slide></Deck>);
    expect(layouts).toHaveLength(1);
    expect(await read('ppt/slides/slide1.xml')).not.toContain('<p:ph');
  });
});

describe('M15-4 — utilitários', () => {
  it('explicitRunStyle completa b e i ausentes', () => {
    expect(explicitRunStyle('<a:rPr lang="pt-BR" b="1"><x/></a:rPr><a:rPr lang="pt-BR"/>')).toBe('<a:rPr lang="pt-BR" b="1" i="0"><x/></a:rPr><a:rPr lang="pt-BR" b="0" i="0"/>');
  });

  it('takeLastDrawings separa os N últimos elementos do spTree', () => {
    const xml = '<p:spTree><p:sp>a</p:sp><p:pic>b</p:pic><p:sp>c</p:sp></p:spTree>';
    expect(takeLastDrawings(xml, 2)).toEqual({ rest: '<p:spTree><p:sp>a</p:sp></p:spTree>', taken: ['<p:pic>b</p:pic>', '<p:sp>c</p:sp>'] });
    expect(takeLastDrawings(xml, 0).rest).toBe(xml);
  });
});
