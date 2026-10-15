import { describe, expect, it } from 'vitest';
import { applySlideNumberFields } from '../../src/emit/slide-number.ts';
import { Box, Deck, Slide, SlideNumber, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { PositionedNode, PositionedText, SlideElement } from '../../src/core/types.ts';
import { build, shapesOf } from '../helpers/build.tsx';

const textsOf = (nodes: readonly PositionedNode[]): readonly PositionedText[] =>
  nodes.flatMap((node) => (node.kind === 'text' ? [node] : node.kind === 'box' ? textsOf(node.children) : []));

const FOOTER = (
  <Box display="flex" justifyContent="space-between" padding="0 20 10">
    <Text fontSize={10}>Rodapé</Text>
    <SlideNumber format="n / total" fontSize={10} />
  </Box>
);

const items = Array.from({ length: 14 }, (_, index) => <Text fontSize={28}>{`Item ${index}`}</Text>);
const deck = (
  <Deck footer={FOOTER}>
    <Slide><Text>Capa</Text></Slide>
    <Slide padding={20}><Box paginate gap={4}>{items}</Box></Slide>
    <Slide><Text>Fim</Text></Slide>
  </Deck>
);

describe('M13-6 — rodapé e número de slide', () => {
  it('rodapé em todo slide (inclusive partes), com path Slide > Footer > … e números do deck de saída', async () => {
    const { positioned, diagnostics } = await build(deck);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(positioned.slides).toHaveLength(4);
    positioned.slides.forEach((slide, index) => {
      const number = textsOf(slide.children).find((text) => text.slideNumber !== undefined)!;
      expect(number.path).toBe('Slide > Footer > Box > SlideNumber');
      expect(number.content).toBe(`${index + 1} / 4`);
      expect(number.slideNumber).toMatchObject({ index: index + 1, total: 4 });
    });
  });

  it('o rodapé não muda os índices dos irmãos do autor', () => {
    const resolved = resolveDeck(
      (<Deck footer={<Text>f</Text>}><Slide><Text>a</Text><Text>b</Text></Slide></Deck>) as SlideElement,
      createContext(resolveSize('16x9')),
    );
    expect(resolved.slides[0]!.children.map((node) => node.path)).toEqual(['Slide > Text[0]', 'Slide > Text[1]', 'Slide > Footer']);
  });

  it('XML: o número é campo slidenum numa caixa; " / total" em outra encostada', async () => {
    const { xml } = await build(deck);
    const third = xml[2]!;
    expect(third).toMatch(/<a:fld id="\{[0-9A-F-]+\}" type="slidenum"><a:rPr[^>]*sz="1000"/);
    expect(third).toMatch(/<a:fld [^>]*><a:rPr[\s\S]*?<a:t>3<\/a:t><\/a:fld>/);
    const fieldBox = shapesOf(third).findIndex((shape) => shape.includes('type="slidenum"'));
    expect(shapesOf(third)[fieldBox]).not.toContain(' / 4');
    expect(shapesOf(third)[fieldBox + 1]).toContain('<a:t> / 4</a:t>');
    expect(third).toContain('Item');
  });

  it('format "n": só o campo, numa caixa', async () => {
    const { xml } = await build(<Deck><Slide><SlideNumber /></Slide><Slide><SlideNumber /></Slide></Deck>);
    expect(xml[1]).toMatch(/type="slidenum"><a:rPr[\s\S]*?<a:t>2<\/a:t><\/a:fld>/);
  });

  it('o pós-processamento só troca o run marcado (não engole runs anteriores)', () => {
    const MARK = '⁠pptsx-slidenum⁠';
    const xml = `<a:p><a:r><a:rPr sz="1"><a:solidFill/></a:rPr><a:t>Título</a:t></a:r><a:r><a:rPr sz="2"/><a:t>${MARK}7</a:t></a:r></a:p>`;
    expect(applySlideNumberFields(xml)).toBe(
      '<a:p><a:r><a:rPr sz="1"><a:solidFill/></a:rPr><a:t>Título</a:t></a:r><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr sz="2"/><a:t>7</a:t></a:fld></a:p>',
    );
  });

  it('format inválido → ResolveError', () => {
    expect(() =>
      resolveDeck((<Deck><Slide><SlideNumber format={'x' as never} /></Slide></Deck>) as SlideElement, createContext(resolveSize('16x9'))),
    ).toThrow(/format "x"/);
  });
});
