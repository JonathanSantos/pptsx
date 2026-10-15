import { describe, expect, it } from 'vitest';
import { B, Box, Deck, Image, Slide, Text, defineLayout } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { Children, ResolvedBox, SlideElement } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

const ctx = createContext(resolveSize('16x9'));
const resolve = (deck: unknown) => resolveDeck(deck as SlideElement, ctx);

const Content = defineLayout('Content', { placeholders: ['title', 'body'] }, ({ title, children }: { title: string; children?: Children }) => (
  <Slide padding={30} gap={10}>
    <Text placeholder="title" fontSize={28}>{title}</Text>
    <Box placeholder="body" flex={1}>{children}</Box>
  </Slide>
));

describe('M15-1 — defineLayout', () => {
  it('o <Slide> do componente recebe o layout; o nome do componente vira o segmento do path', () => {
    const deck = resolve(<Deck><Content title="A"><Text>x</Text></Content><Slide /></Deck>);
    expect(deck.slides[0]!.layout).toEqual({ name: 'Content', placeholders: ['title', 'body'] });
    expect(deck.slides[0]!.path).toBe('Content');
    expect(deck.slides[1]!.layout).toBeUndefined();
    expect(deck.slides[0]!.children[0]!.props).toMatchObject({ placeholder: 'title' });
  });

  it('fixed entra como invólucro absoluto atrás do conteúdo, com fixedPath; background vira hex', () => {
    const Branded = defineLayout('Branded', { placeholders: [], background: 'red', fixed: <Text position="absolute" right={10} bottom={10}>logo</Text> }, () => <Slide><Text>c</Text></Slide>);
    const slide = resolve(<Deck><Branded /></Deck>).slides[0]!;
    expect(slide.layout).toMatchObject({ name: 'Branded', background: '#FF0000', fixedPath: 'Branded > Fixed' });
    const fixed = slide.children[1] as ResolvedBox;
    expect(fixed.path).toBe('Branded > Fixed');
    expect(fixed.css).toMatchObject({ position: 'absolute', zIndex: -1 });
  });

  it('placeholder fora de layout, não declarado ou repetido → ResolveError', () => {
    expect(() => resolve(<Deck><Slide><Text placeholder="title">x</Text></Slide></Deck>)).toThrow(/fora de um layout/);
    const Bad = defineLayout('Bad', { placeholders: ['title'] }, () => <Slide><Image src="x.png" placeholder="pictures" /></Slide>);
    expect(() => resolve(<Deck><Bad /></Deck>)).toThrow(/"pictures" não existe no layout "Bad" \(declarados: "title"\)/);
    const Twice = defineLayout('Twice', { placeholders: ['title'] }, () => <Slide><Text placeholder="title">a</Text><Text placeholder="title">b</Text></Slide>);
    expect(() => resolve(<Deck><Twice /></Deck>)).toThrow(/usado duas vezes/);
    expect(() => resolve(<Deck><Slide><Text placeholder="">x</Text></Slide></Deck>)).toThrow(/placeholder/);
  });

  it('layout com nome vazio, placeholder repetido ou dois layouts com o mesmo nome → ResolveError', () => {
    const Empty = defineLayout('', { placeholders: [] }, () => <Slide />);
    expect(() => resolve(<Deck><Empty /></Deck>)).toThrow(/nome do layout não pode ser vazio/);
    const Rep = defineLayout('Rep', { placeholders: ['body', 'body'] }, () => <Slide />);
    expect(() => resolve(<Deck><Rep /></Deck>)).toThrow(/"body" repetido/);
    const A = defineLayout('Same', { placeholders: [] }, () => <Slide />);
    const B2 = defineLayout('Same', { placeholders: [] }, () => <Slide />);
    expect(() => resolve(<Deck><A /><B2 /></Deck>)).toThrow(/Dois layouts diferentes com o nome "Same"/);
    expect(() => resolve(<Deck><A /><A /></Deck>)).not.toThrow();
  });
});

describe('M15-1 — notas, oculto e seções', () => {
  it('notas em rich text viram runs; string continua um run; hidden passa', () => {
    const deck = resolve(
      <Deck>
        <Slide hidden notes={<>Abra com <B>a meta</B>.{'\n'}Depois o gráfico.</>} />
        <Slide notes="simples" />
        <Slide />
      </Deck>,
    );
    const [rich, plain, none] = deck.slides;
    expect(rich!.notes!.content).toBe('Abra com a meta.\nDepois o gráfico.');
    expect(rich!.notes!.runs.map((run) => run.weight)).toEqual(['regular', 'bold', 'regular']);
    expect(rich!.props.hidden).toBe(true);
    expect(plain!.notes!.runs).toHaveLength(1);
    expect(none!.notes).toBeUndefined();
  });

  it('seções validadas: ordem crescente, dentro do deck, título não vazio', () => {
    const slides = [<Slide />, <Slide />, <Slide />];
    expect(resolve(<Deck sections={[{ title: 'A', from: 1 }, { title: 'B', from: 3 }]}>{slides}</Deck>).sections).toEqual([{ title: 'A', from: 1 }, { title: 'B', from: 3 }]);
    expect(() => resolve(<Deck sections={[{ title: 'A', from: 4 }]}>{slides}</Deck>)).toThrow(/o deck tem 3 slides/);
    expect(() => resolve(<Deck sections={[{ title: 'A', from: 2 }, { title: 'B', from: 2 }]}>{slides}</Deck>)).toThrow(/ordene por from/);
    expect(() => resolve(<Deck sections={[{ title: ' ', from: 1 }]}>{slides}</Deck>)).toThrow(/título vazio/);
    expect(() => resolve(<Deck sections={[{ title: 'A' }] as never}>{slides}</Deck>)).toThrow(/precisa de \{ title/);
  });
});

describe('M15-1 — placeholder-unused', () => {
  it('info uma vez por layout, no 1º slide dele (número de saída)', async () => {
    const Two = defineLayout('Two', { placeholders: ['title', 'subtitle'] }, ({ t }: { t: string }) => <Slide padding={30}><Text placeholder="title">{t}</Text></Slide>);
    const { diagnostics } = await build(<Deck><Slide /><Two t="a" /><Two t="b" /></Deck>);
    const unused = diagnostics.filter((d) => d.code === 'placeholder-unused');
    expect(unused).toHaveLength(1);
    expect(unused[0]).toMatchObject({ severity: 'info', slide: 2, path: 'Two', data: { layout: 'Two', placeholders: ['subtitle'] } });
  });
});
