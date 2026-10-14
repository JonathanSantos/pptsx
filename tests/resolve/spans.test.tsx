import { describe, expect, it } from 'vitest';
import type { ResolvedDeck, ResolvedText, SlideElement, TextRun } from '../../src/core/types.ts';
import { jsx } from '../../src/jsx/jsx-runtime.ts';
import { B, Box, Deck, I, Shape, Slide, Span, Text } from '../../src/primitives/index.ts';
import * as api from '../../src/index.ts';
import { ResolveError, resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';

/** M9: resolveDeck exige ctx; estes testes não usam props responsivas, então 16x9 basta. */
const RESOLVE_CTX = createContext(resolveSize('16x9'));

/**
 * M8-A: Span/B/I dentro de Text viram `runs` (estilo efetivo = Text sobrescrito
 * pelos Span do caminho, o mais interno vence); `content` continua o texto plano;
 * Span não vira nó nem entra no path.
 */

const slideOf = (deck: ResolvedDeck) => {
  const slide = deck.slides[0];
  if (!slide) throw new Error('no slide');
  return slide;
};

const textNode = (el: SlideElement): ResolvedText => {
  const node = slideOf(resolveDeck(<Deck><Slide>{el}</Slide></Deck>, RESOLVE_CTX)).children[0];
  if (!node || node.kind !== 'text') throw new Error('expected text');
  return node;
};

const run = (text: string, over: Partial<Omit<TextRun, 'text'>> = {}): TextRun => ({
  text,
  weight: 'regular',
  italic: false,
  color: '#000000',
  ...over,
});

const expectResolveError = (root: SlideElement): ResolveError => {
  let caught: unknown;
  try {
    resolveDeck(root, RESOLVE_CTX);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ResolveError);
  return caught as ResolveError;
};

describe('resolve — runs from Span/B/I', () => {
  const sentence = (
    <Text>
      Receita <B>subiu <I>14%</I></B> em <Span color="#2F6FED">todas</Span> as regiões
    </Text>
  );

  it('splits the sentence into 6 runs with merged styles (bold+italic on "14%")', () => {
    expect(textNode(sentence).runs).toEqual([
      run('Receita '),
      run('subiu ', { weight: 'bold' }),
      run('14%', { weight: 'bold', italic: true }),
      run(' em '),
      run('todas', { color: '#2F6FED' }),
      run(' as regiões'),
    ]);
  });

  it('content is the concatenation of the runs', () => {
    const node = textNode(sentence);
    expect(node.content).toBe('Receita subiu 14% em todas as regiões');
    expect(node.runs.map((r) => r.text).join('')).toBe(node.content);
  });

  it('inherits weight/italic/color from the Text', () => {
    const node = textNode(
      <Text color="#FF0000" italic>
        a<Span weight="bold">b</Span>
      </Text>,
    );
    expect(node.runs).toEqual([
      run('a', { color: '#FF0000', italic: true }),
      run('b', { color: '#FF0000', italic: true, weight: 'bold' }),
    ]);
  });

  it('the innermost Span wins', () => {
    const node = textNode(
      <Text>
        <Span color="#111111">
          a<Span color="#222222">b</Span>
        </Span>
      </Text>,
    );
    expect(node.runs).toEqual([run('a', { color: '#111111' }), run('b', { color: '#222222' })]);
  });

  it('a Span can turn off italic/bold inherited from the Text', () => {
    const node = textNode(
      <Text weight="bold" italic>
        a<Span weight="regular" italic={false}>b</Span>
      </Text>,
    );
    expect(node.runs).toEqual([run('a', { weight: 'bold', italic: true }), run('b')]);
  });

  it('accepts numbers inside a Span', () => {
    const node = textNode(
      <Text>
        alta de <B>{14}%</B>
      </Text>,
    );
    expect(node.content).toBe('alta de 14%');
    expect(node.runs).toEqual([run('alta de '), run('14%', { weight: 'bold' })]);
  });

  it('merges adjacent runs with the same style', () => {
    const node = textNode(
      <Text>
        a<Span>b</Span>
        <B>c</B>
        <B>d</B>
        <I>
          <Span>e</Span>f
        </I>
      </Text>,
    );
    expect(node.runs).toEqual([run('ab'), run('cd', { weight: 'bold' }), run('ef', { italic: true })]);
  });

  it('a B inside a bold Text is a single run', () => {
    const node = textNode(
      <Text weight="bold">
        x<B>y</B>z
      </Text>,
    );
    expect(node.runs).toEqual([run('xyz', { weight: 'bold' })]);
  });

  it('a Text without Span is a single run with the Text style', () => {
    expect(textNode(<Text weight="bold">Olá</Text>).runs).toEqual([run('Olá', { weight: 'bold' })]);
  });

  it('keeps "\\n" inside the runs (content still separates paragraphs)', () => {
    const node = textNode(<Text>{'a\n'}<B>{'b\nc'}</B></Text>);
    expect(node.content).toBe('a\nb\nc');
    expect(node.runs.map((r) => r.text).join('')).toBe(node.content);
  });

  it('an empty Text has runs: []', () => {
    expect(textNode(<Text />).runs).toEqual([]);
    expect(textNode(<Text>{null}{false}</Text>).runs).toEqual([]);
  });

  it('empty Spans produce no runs', () => {
    const node = textNode(
      <Text>
        a<B />
        <Span color="#123456">{null}</Span>b
      </Text>,
    );
    expect(node.runs).toEqual([run('ab')]);
  });

  it('accepts a user component that expands to a Span inside Text', () => {
    const Money = (props: { readonly value: string }) => <B>{props.value}</B>;
    const node = textNode(
      <Text>
        total <Money value="R$ 10" />
      </Text>,
    );
    expect(node.runs).toEqual([run('total '), run('R$ 10', { weight: 'bold' })]);
  });

  it('props of the resolved Text stay as the author wrote them (no runs inside props)', () => {
    const node = textNode(
      <Text size={20}>
        a<B>b</B>
      </Text>,
    );
    expect(node.props).toEqual({ size: 20 });
  });
});

describe('resolve — Span is not a node', () => {
  it('Span does not appear in the path nor counts as a sibling', () => {
    const slide = slideOf(
      resolveDeck(
        <Deck>
          <Slide>
            <Text>
              a<B>b</B>
              <I>c</I>
            </Text>
            <Text>d</Text>
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.path)).toEqual(['Slide > Text[0]', 'Slide > Text[1]']);
    expect(slide.children.map((c) => c.kind)).toEqual(['text', 'text']);
  });

  it('the Text keeps the component path even with Spans inside', () => {
    const Title = () => (
      <Text>
        a <B>b</B>
      </Text>
    );
    const slide = slideOf(resolveDeck(<Deck><Slide><Box><Title /></Box></Slide></Deck>, RESOLVE_CTX));
    const box = slide.children[0];
    expect(box?.kind === 'box' ? box.children.map((c) => c.path) : []).toEqual(['Slide > Box > Title']);
  });
});

describe('resolve — invalid nesting', () => {
  it('<B> directly inside a Slide → ResolveError with the parent path', () => {
    const err = expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(B, { children: 'x' }) }) }));
    expect(err.message).toMatch(/só pode aparecer dentro de <Text>/);
    expect(err.path).toBe('Slide');
  });

  it('<Span> inside a Box → ResolveError with the Box path', () => {
    const Card = () => jsx(Box, { children: jsx(Span, { children: 'x' }) });
    const err = expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Card, {}) }) }));
    expect(err.message).toMatch(/só pode aparecer dentro de <Text>/);
    expect(err.path).toContain('Slide > Card');
  });

  it('<I> as a Deck child → ResolveError', () => {
    expectResolveError(jsx(Deck, { children: jsx(I, { children: 'x' }) }));
  });

  it('<Text> inside <Text> is still a ResolveError', () => {
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Text, { children: jsx(Text, {}) }) }) }));
  });

  it('<Text> inside a <B> inside a <Text> → ResolveError', () => {
    expectResolveError(
      jsx(Deck, { children: jsx(Slide, { children: jsx(Text, { children: jsx(B, { children: jsx(Text, {}) }) }) }) }),
    );
  });

  it('<Shape> inside a <Span> → ResolveError naming what Text accepts', () => {
    const err = expectResolveError(
      jsx(Deck, {
        children: jsx(Slide, { children: jsx(Text, { children: jsx(Span, { children: jsx(Shape, { kind: 'rect' }) }) }) }),
      }),
    );
    expect(err.message).toMatch(/<Span>/);
  });
});

describe('Span/B/I — public API and types', () => {
  it('Span, B and I are exported from src/index.ts', () => {
    expect(api.Span).toBe(Span);
    expect(api.B).toBe(B);
    expect(api.I).toBe(I);
  });

  it('size/font/lineHeight are not per-run props (does not compile)', () => {
    // @ts-expect-error size não é por run
    const sized = <Span size={20}>x</Span>;
    // @ts-expect-error font não é por run
    const font = <B font="Inter">x</B>;
    expect(sized).toBeDefined();
    expect(font).toBeDefined();
  });
});
