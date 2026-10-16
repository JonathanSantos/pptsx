import { describe, expect, it } from 'vitest';
import { Box, Deck, Slide, Text, defineComponent } from '../../src/primitives/index.ts';
import { authorSourceOf } from '../../src/resolve/source.ts';
import { resolveDeck } from '../../src/resolve/resolve.ts';
import { createContext } from '../../src/sizes.ts';
import type { ResolvedNode, SlideElement } from '../../src/core/types.ts';

/**
 * 1.0.5 (CONTRACTS §resolve "Componente do autor"): o nó raiz de uma instância de componente leva em
 * `source` o `<Nome prop=valor … />` resumido; filhos não herdam; primitiva direta não tem.
 */

const resolve = (slide: SlideElement) => resolveDeck(<Deck>{slide}</Deck>, createContext({ name: '16x9', width: 960, height: 540 })).slides[0]!;

const flatten = (nodes: readonly ResolvedNode[]): readonly ResolvedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...flatten(node.children)] : [node]));

describe('authorSourceOf', () => {
  it('resume as props: string curta entre aspas, número e booleano literais, array pelo tamanho, objeto pelas chaves', () => {
    const source = authorSourceOf({ name: 'Risks' }, { items: [1, 2, 3, 4], status: 'warn', compact: true, max: 3, theme: { a: 1, b: 2, c: 3, d: 4, e: 5 } });
    expect(source).toBe('<Risks items=[4 itens] status="warn" compact=true max=3 theme={a, b, c, d} />');
  });

  it('corta strings longas em 40 caracteres com reticências; pula children, undefined e null', () => {
    const long = 'x'.repeat(50);
    expect(authorSourceOf({ name: 'Card' }, { title: long, children: 'c', footer: undefined, kicker: null })).toBe(`<Card title="${'x'.repeat(40)}…" />`);
  });

  it('função vira fn, elemento vira <…>, regex vira regex; sem props: <Nome />', () => {
    expect(authorSourceOf({ name: 'Slot' }, { render: () => 1, aside: <Text>a</Text>, match: /a/ })).toBe('<Slot render=fn aside=<…> match=regex />');
    expect(authorSourceOf({ name: 'Empty' }, {})).toBe('<Empty />');
  });

  it('componente anônimo não tem source', () => {
    expect(authorSourceOf({ name: 'Anonymous' }, { a: 1 })).toBeUndefined();
    expect(authorSourceOf({ name: '' }, {})).toBeUndefined();
  });
});

describe('resolveDeck — ResolvedBase.source', () => {
  const Card = (props: { readonly title: string; readonly items: readonly string[] }) => (
    <Box padding={10}>
      <Text>{props.title}</Text>
      {props.items.map((item) => <Text>{item}</Text>)}
    </Box>
  );

  it('o nó raiz da instância leva o source; os filhos não', () => {
    const slide = resolve(
      <Slide>
        <Card title="Riscos" items={['a', 'b']} />
        <Text>solto</Text>
      </Slide>,
    );
    const nodes = flatten(slide.children);
    const card = nodes.find((node) => node.path === 'Slide > Card')!;
    expect(card.source).toBe('<Card title="Riscos" items=[2 itens] />');
    expect(card.component?.name).toBe('Card');
    expect(nodes.find((node) => node.path === 'Slide > Card > Text[0]')!.source).toBeUndefined();
    expect(nodes.find((node) => node.path === 'Slide > Text')!.source).toBeUndefined();
    expect(slide.source).toBeUndefined();
  });

  it('componentes aninhados: vale o mais externo (o mesmo que dá o segmento do path)', () => {
    const Wrapper = (props: { readonly label: string }) => <Card title={props.label} items={['x']} />;
    const slide = resolve(<Slide><Wrapper label="fora" /></Slide>);
    const root = slide.children[0]!;
    expect(root.path).toBe('Slide > Wrapper');
    expect(root.source).toBe('<Wrapper label="fora" />');
  });

  it('defineComponent: o nome do meta, mesmo com displayName diferente no path', () => {
    const Kpi = defineComponent({ name: 'Kpi', displayName: 'KpiCard' }, (props: { readonly value: string }) => <Text>{props.value}</Text>);
    const slide = resolve(<Slide><Kpi value="42" /></Slide>);
    expect(slide.children[0]!.path).toBe('Slide > KpiCard');
    expect(slide.children[0]!.source).toBe('<Kpi value="42" />');
  });

  it('componente que devolve o Slide: o source fica no slide', () => {
    const Cover = (props: { readonly title: string }) => <Slide><Text>{props.title}</Text></Slide>;
    const slide = resolve(<Cover title="Capa" />);
    expect(slide.path).toBe('Cover');
    expect(slide.source).toBe('<Cover title="Capa" />');
  });
});
