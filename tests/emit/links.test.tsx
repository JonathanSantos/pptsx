import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Box, Deck, Image, Slide, Span, Text } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { SlideElement } from '../../src/core/types.ts';
import { build, shapesOf } from '../helpers/build.tsx';

const EXAMPLES = new URL('../../examples/', import.meta.url).pathname;

const rels = async (deck: SlideElement, slide = 1): Promise<{ xml: string; rels: string }> => {
  const [result] = await render(() => deck, { preview: false, baseDir: EXAMPLES });
  const zip = await JSZip.loadAsync(result!.buffer);
  return {
    xml: await zip.file(`ppt/slides/slide${slide}.xml`)!.async('string'),
    rels: await zip.file(`ppt/slides/_rels/slide${slide}.xml.rels`)!.async('string'),
  };
};

describe('M13-4 — resolve', () => {
  const ctx = createContext(resolveSize('16x9'));
  const resolve = (node: unknown) => resolveDeck((<Deck><Slide>{node as never}</Slide></Deck>) as SlideElement, ctx);

  it('href do Text vale para os runs; o do Span vence', () => {
    const text = resolve(<Text href="https://a.com">x <Span href="slide:2">y</Span> z</Text>).slides[0]!.children[0]!;
    if (text.kind !== 'text') throw new Error('text');
    expect(text.runs.map((run) => [run.text, run.href])).toEqual([['x ', 'https://a.com'], ['y', 'slide:2'], [' z', 'https://a.com']]);
  });

  it.each(['slide:0', 'slide:x', 'www.a.com', ''])('href inválido "%s" → ResolveError', (href) => {
    expect(() => resolve(<Text href={href}>x</Text>)).toThrow(/Prop "href"/);
  });
});

describe('M13-4 — PPTX', () => {
  it('run com URL → hlinkClick + relacionamento externo', async () => {
    const { xml, rels: r } = await rels(<Deck><Slide><Text>Veja <Span href="https://pptsx.dev/doc">a documentação</Span>.</Text></Slide></Deck>);
    expect(xml).toMatch(/<a:hlinkClick r:id="rId\d+"/);
    expect(r).toContain('Target="https://pptsx.dev/doc"');
    expect(r).toContain('TargetMode="External"');
  });

  it('slide:3 depois da paginação do slide 2 aponta para o 4º slide de saída', async () => {
    const items = Array.from({ length: 14 }, (_, index) => <Text fontSize={28}>{`Item ${index}`}</Text>);
    const deck = (
      <Deck>
        <Slide><Text href="slide:3">Ir para o fim</Text></Slide>
        <Slide padding={20}><Box paginate gap={4}>{items}</Box></Slide>
        <Slide><Text>Fim</Text></Slide>
      </Deck>
    );
    const { positioned } = await build(deck);
    expect(positioned.slides.length).toBe(4);
    const { xml, rels: r } = await rels(deck);
    expect(xml).toContain('action="ppaction://hlinksldjump"');
    expect(r).toMatch(/Target="slide4\.xml"/);
  });

  it('slide:N fora do deck → link-target-missing (error) e o link some', async () => {
    const { diagnostics, xml } = await build(<Deck><Slide><Text href="slide:9">x</Text></Slide></Deck>);
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'link-target-missing', severity: 'error', path: 'Slide > Text' })]);
    expect(diagnostics[0]!.message).toMatch(/o deck tem 1 slide/);
    expect(xml[0]).not.toContain('hlinkClick');
  });

  it('imagem e Box (com fundo e sem fundo) recebem o link', async () => {
    const { xml } = await rels(
      <Deck>
        <Slide>
          <Image src="./assets/chart.png" width={100} href="https://a.com/img" />
          <Box width={100} height={40} backgroundColor="#EEEEEE" href="https://a.com/box" />
          <Box width={100} height={40} href="slide:1" />
        </Slide>
      </Deck>,
    );
    expect((xml.match(/<a:hlinkClick/g) ?? []).length).toBe(3);
    const shapes = shapesOf(xml);
    expect(shapes.at(-1)).toContain('<a:alpha val="0"/>');
  });

  it('preview: o SVG ganha <a href>', async () => {
    const { svg } = await build(<Deck><Slide><Text href="https://a.com">x</Text><Box width={10} height={10} backgroundColor="#000000" href="slide:1" /></Slide></Deck>);
    expect(svg[0]).toContain('<a href="https://a.com">');
    expect(svg[0]).toContain('<a href="#slide-1">');
  });
});
