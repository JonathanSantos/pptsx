import { describe, expect, it } from 'vitest';
import type { Child, Component, ResolvedDeck, ResolvedSlide, SlideElement } from '../../src/core/types.ts';
import { jsx } from '../../src/jsx/jsx-runtime.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { ResolveError, resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';

/** M9: resolveDeck exige ctx; estes testes não usam props responsivas, então 16x9 basta. */
const RESOLVE_CTX = createContext(resolveSize('16x9'));

const firstSlide = (deck: ResolvedDeck): ResolvedSlide => {
  const slide = deck.slides[0];
  if (!slide) throw new Error('no slide');
  return slide;
};

/** Coleta os paths em pré-ordem (slide incluído). */
const collectPaths = (slide: ResolvedSlide): string[] => {
  const out: string[] = [];
  const walk = (node: { path: string; children?: readonly unknown[] }) => {
    out.push(node.path);
    for (const c of node.children ?? []) walk(c as { path: string; children?: readonly unknown[] });
  };
  walk(slide as unknown as { path: string; children: readonly unknown[] });
  return out;
};

const expectResolveError = (root: SlideElement): ResolveError => {
  let caught: unknown;
  try {
    resolveDeck(root, RESOLVE_CTX);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ResolveError);
  expect(caught).toBeInstanceOf(Error);
  expect(typeof (caught as ResolveError).path).toBe('string');
  return caught as ResolveError;
};

// ───────────── árvore completa ─────────────

describe('resolveDeck — full tree', () => {
  const Title = (props: { text: string }) => (
    <Text size={40} weight="bold">
      {props.text}
    </Text>
  );
  const CoverLayout = (props: { title: string; subtitle: string }) => (
    <Slide background="#112233" notes="speaker notes">
      <Box position="absolute" left={10} top={20} width={300} height={100} fill="#ffffff">
        <Title text={props.title} />
        <Text size={20}>{props.subtitle}</Text>
      </Box>
    </Slide>
  );
  const deck = (
    <Deck>
      <CoverLayout title="Hello" subtitle="World" />
      <Slide>
        <Shape kind="ellipse" position="absolute" width={50} height={50} fill="#ff0000" />
        <Image src="img.png" width={100} />
      </Slide>
    </Deck>
  );

  // M16: a geometria fica só em `css`; `props` guarda o que não é CSS (texto resolvido, src…). O Box
  // guarda `fill` como css.backgroundColor; a forma (Shape) guarda o próprio fill em props.
  const run = (text: string, weight: 'regular' | 'bold') => ({ text, weight, italic: false, color: '#000000', underline: false, lineThrough: false });

  it('matches the expected resolved tree', () => {
    const resolved = resolveDeck(deck, RESOLVE_CTX);
    expect(resolved).toMatchObject({
      slides: [
        {
          kind: 'slide',
          path: 'CoverLayout',
          sourceSlide: 1,
          css: { backgroundColor: '#112233' },
          props: { notes: 'speaker notes' },
          children: [
            {
              kind: 'box',
              path: 'CoverLayout > Box',
              css: { position: 'absolute', inset: { left: 10, top: 20 }, width: 300, height: 100, backgroundColor: '#FFFFFF' },
              props: {},
              children: [
                { kind: 'text', path: 'CoverLayout > Box > Title', props: { size: 40, weight: 'bold' }, content: 'Hello', runs: [run('Hello', 'bold')] },
                { kind: 'text', path: 'CoverLayout > Box > Text', props: { size: 20 }, content: 'World', runs: [run('World', 'regular')] },
              ],
            },
          ],
        },
        {
          kind: 'slide',
          path: 'Slide',
          sourceSlide: 2,
          children: [
            {
              kind: 'shape',
              path: 'Slide > Shape',
              css: { position: 'absolute', width: 50, height: 50 },
              props: { kind: 'ellipse', fill: '#FF0000' },
            },
            { kind: 'image', path: 'Slide > Image', css: { width: 100 }, props: { src: 'img.png' } },
          ],
        },
      ],
    });
  });

  it('every node carries css and props', () => {
    const resolved = resolveDeck(deck, RESOLVE_CTX);
    const walk = (node: { readonly css?: unknown; readonly props?: unknown; readonly children?: readonly unknown[] }): boolean =>
      node.css !== undefined && node.props !== undefined && (node.children ?? []).every((c) => walk(c as typeof node));
    expect(resolved.slides.every(walk)).toBe(true);
  });

  it('matches the stored snapshot', () => {
    expect(resolveDeck(deck, RESOLVE_CTX)).toMatchSnapshot();
  });
});

// ───────────── expansão ─────────────

describe('resolveDeck — expansion', () => {
  it('accepts a component that returns the Deck as root', () => {
    const MyDeck = () => (
      <Deck>
        <Slide />
      </Deck>
    );
    const resolved = resolveDeck(<MyDeck />, RESOLVE_CTX);
    expect(resolved.slides).toHaveLength(1);
    expect(firstSlide(resolved).kind).toBe('slide');
  });

  it('calls components with their props including children', () => {
    let received: unknown;
    const Wrapper = (props: { color: string; children?: Child }) => {
      received = props;
      return <Box fill={props.color}>{props.children}</Box>;
    };
    const resolved = resolveDeck(
      <Deck>
        <Slide>
          <Wrapper color="#00ff00">
            <Text>inside</Text>
          </Wrapper>
        </Slide>
      </Deck>,
      RESOLVE_CTX,
    );
    expect(received).toMatchObject({ color: '#00ff00' });
    expect((received as { children: SlideElement }).children.type).toBe(Text);
    const box = firstSlide(resolved).children[0];
    expect(box).toMatchObject({ kind: 'box', css: { backgroundColor: '#00FF00' } });
    expect(box && 'children' in box ? box.children[0] : undefined).toMatchObject({ kind: 'text', content: 'inside' });
  });

  it('resolves nested components recursively', () => {
    const Inner = () => <Text>deep</Text>;
    const Middle = () => <Inner />;
    const Outer = () => (
      <Box>
        <Middle />
      </Box>
    );
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            <Outer />
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children).toMatchObject([
      {
        kind: 'box',
        path: 'Slide > Outer',
        children: [
          {
            kind: 'text',
            path: 'Slide > Outer > Middle',
            content: 'deep',
            runs: [{ text: 'deep', weight: 'regular', italic: false, color: '#000000', underline: false, lineThrough: false }],
          },
        ],
      },
    ]);
    expect(slide.children).toHaveLength(1);
  });

  it('flattens fragments', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            <>
              <Box />
              <>
                <Shape kind="rect" />
              </>
            </>
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.kind)).toEqual(['box', 'shape']);
  });

  it('flattens arrays (e.g. from map)', () => {
    const items = ['a', 'b', 'c'];
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>{items.map((i) => <Text key={i}>{i}</Text>)}</Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => (c.kind === 'text' ? c.content : c.kind))).toEqual(['a', 'b', 'c']);
  });

  it('flattens fragments and arrays among Deck children into slides', () => {
    const resolved = resolveDeck(
      <Deck>
        <>
          <Slide />
          <Slide />
        </>
        {[1, 2].map((n) => (
          <Slide key={n} />
        ))}
      </Deck>,
      RESOLVE_CTX,
    );
    expect(resolved.slides).toHaveLength(4);
  });

  it('discards null, undefined, true and false', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          {null}
          <Slide>
            {null}
            {undefined}
            {true}
            {false}
            <Box />
          </Slide>
          {false}
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.kind)).toEqual(['box']);
  });

  it('discards a component that returns null', () => {
    const Nothing = (() => null) as unknown as Component;
    const slide = firstSlide(resolveDeck(jsx(Deck, { children: jsx(Slide, { children: [jsx(Nothing, {}), jsx(Box, {})] }) }), RESOLVE_CTX));
    expect(slide.children.map((c) => c.kind)).toEqual(['box']);
  });

  it('produces a slide with no children as an empty array', () => {
    expect(firstSlide(resolveDeck(<Deck><Slide /></Deck>, RESOLVE_CTX)).children).toEqual([]);
  });
});

// ───────────── Text ─────────────

describe('resolveDeck — Text content', () => {
  const textOf = (el: SlideElement): string => {
    const node = firstSlide(resolveDeck(<Deck><Slide>{el}</Slide></Deck>, RESOLVE_CTX)).children[0];
    if (!node || node.kind !== 'text') throw new Error('expected text');
    return node.content;
  };

  it('concatenates strings and numbers without separator', () => {
    const n = 3;
    expect(textOf(<Text>Total: {n} items</Text>)).toBe('Total: 3 items');
  });

  it('concatenates numbers including zero', () => {
    expect(textOf(<Text>{0}{1.5}</Text>)).toBe('01.5');
  });

  it('flattens nested arrays inside Text', () => {
    expect(textOf(<Text>{['a', ['b', 'c']]}d</Text>)).toBe('abcd');
  });

  it('discards null/undefined/booleans inside Text', () => {
    expect(textOf(<Text>a{null}{false}{undefined}{true}b</Text>)).toBe('ab');
  });

  it('keeps newlines as paragraph separators', () => {
    expect(textOf(<Text>{'line 1\nline 2'}</Text>)).toBe('line 1\nline 2');
  });

  it('yields empty content for an empty Text', () => {
    expect(textOf(<Text />)).toBe('');
  });
});

// ───────────── props ─────────────

describe('resolveDeck — props', () => {
  // M11: `props` é a visão da engine derivada do css (CONTRACTS §M11 nº 5): o que o autor
  // escreveu aparece com os nomes da engine e os padrões preenchidos; o css guarda o resto.
  it('derives the engine view of props, without children', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide direction="row" gap={4}>
            <Box padding={8} fill="#000000">
              <Text size={12}>x</Text>
            </Box>
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.css).toMatchObject({ flexDirection: 'row', columnGap: 4 });
    expect(slide.props).not.toHaveProperty('children');
    const box = slide.children[0];
    expect(box?.css).toMatchObject({ padding: { top: 8, right: 8, bottom: 8, left: 8 } });
    expect(box?.css).toMatchObject({ backgroundColor: '#000000', padding: { top: 8, right: 8, bottom: 8, left: 8 } });
    expect(box?.props).not.toHaveProperty('children');
    const text = box && box.kind === 'box' ? box.children[0] : undefined;
    expect(text?.props).toMatchObject({ size: 12 });
    expect(text?.props).not.toHaveProperty('children');
  });

  it('a Text without props has the initial css and no text style in props', () => {
    const node = firstSlide(resolveDeck(<Deck><Slide><Text>x</Text></Slide></Deck>, RESOLVE_CTX)).children[0];
    expect(node?.props).not.toHaveProperty('size');
    expect(node?.props).not.toHaveProperty('font');
    expect(node?.css).toMatchObject({ display: 'block', position: 'static', notEmitted: [] });
  });
});

// ───────────── path ─────────────

describe('resolveDeck — path rules', () => {
  it("names nodes 'CoverLayout > Box > Text[i]' for a component returning Slide>Box>(Text,Text)", () => {
    const CoverLayout = () => (
      <Slide>
        <Box>
          <Text>a</Text>
          <Text>b</Text>
        </Box>
      </Slide>
    );
    const slide = firstSlide(resolveDeck(<Deck><CoverLayout /></Deck>, RESOLVE_CTX));
    expect(collectPaths(slide)).toEqual([
      'CoverLayout',
      'CoverLayout > Box',
      'CoverLayout > Box > Text[0]',
      'CoverLayout > Box > Text[1]',
    ]);
  });

  it('uses the plain primitive name for slides without component', () => {
    expect(firstSlide(resolveDeck(<Deck><Slide /></Deck>, RESOLVE_CTX)).path).toBe('Slide');
  });

  it('never indexes slides even when the deck has several', () => {
    const resolved = resolveDeck(
      <Deck>
        <Slide />
        <Slide />
      </Deck>,
      RESOLVE_CTX,
    );
    expect(resolved.slides.map((s) => s.path)).toEqual(['Slide', 'Slide']);
  });

  it('does not include the Deck in the path', () => {
    const slide = firstSlide(resolveDeck(<Deck><Slide><Box /></Slide></Deck>, RESOLVE_CTX));
    expect(slide.children[0]?.path).toBe('Slide > Box');
  });

  it('adds [i] only to siblings sharing the same segment', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            <Box />
            <Text>a</Text>
            <Box />
            <Image src="x.png" />
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.path)).toEqual([
      'Slide > Box[0]',
      'Slide > Text',
      'Slide > Box[1]',
      'Slide > Image',
    ]);
  });

  it('indexes component segments among siblings of the same component', () => {
    const Card = () => <Box />;
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            <Card />
            <Box />
            <Card />
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.path)).toEqual(['Slide > Card[0]', 'Slide > Box', 'Slide > Card[1]']);
  });

  it('counts siblings after flattening fragments and arrays', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            <>
              <Text>a</Text>
            </>
            {[<Text key="b">b</Text>]}
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.path)).toEqual(['Slide > Text[0]', 'Slide > Text[1]']);
  });

  it('ignores discarded children when counting siblings', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            {null}
            <Text>a</Text>
            {false}
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(slide.children.map((c) => c.path)).toEqual(['Slide > Text']);
  });

  it('uses the outermost component name when components are nested', () => {
    const Inner = () => <Box />;
    const Outer = () => <Inner />;
    const slide = firstSlide(resolveDeck(<Deck><Slide><Outer /></Slide></Deck>, RESOLVE_CTX));
    expect(slide.children[0]?.path).toBe('Slide > Outer');
  });

  it('uses the outermost component name for the slide too', () => {
    const Inner = () => <Slide />;
    const Page = () => <Inner />;
    expect(firstSlide(resolveDeck(<Deck><Page /></Deck>, RESOLVE_CTX)).path).toBe('Page');
  });

  it('names primitives inside a component by their own name below the component segment', () => {
    const Bullets = () => (
      <Box>
        <Box>
          <Text>a</Text>
        </Box>
        <Box>
          <Text>b</Text>
        </Box>
      </Box>
    );
    const slide = firstSlide(resolveDeck(<Deck><Slide><Bullets /></Slide></Deck>, RESOLVE_CTX));
    expect(collectPaths(slide)).toEqual([
      'Slide',
      'Slide > Bullets',
      'Slide > Bullets > Box[0]',
      'Slide > Bullets > Box[0] > Text',
      'Slide > Bullets > Box[1]',
      'Slide > Bullets > Box[1] > Text',
    ]);
  });

  it("uses 'Anonymous' for components without a name", () => {
    const slide = firstSlide(
      resolveDeck(jsx(Deck, { children: jsx(Slide, { children: jsx((() => jsx(Box, {})) as Component, {}) }) }), RESOLVE_CTX),
    );
    expect(slide.children[0]?.path).toBe('Slide > Anonymous');
  });

  it('gives every primitive returned in a fragment by a component the component segment', () => {
    const Pair = () => (
      <>
        <Box />
        <Box />
      </>
    );
    const slide = firstSlide(resolveDeck(<Deck><Slide><Pair /></Slide></Deck>, RESOLVE_CTX));
    expect(slide.children.map((c) => c.path)).toEqual(['Slide > Pair[0]', 'Slide > Pair[1]']);
  });

  it('uses each primitive kind segment for Shape and Image', () => {
    const slide = firstSlide(
      resolveDeck(
        <Deck>
          <Slide>
            <Box>
              <Shape kind="rect" />
              <Image src="a.png" />
            </Box>
          </Slide>
        </Deck>,
        RESOLVE_CTX,
      ),
    );
    expect(collectPaths(slide)).toEqual(['Slide', 'Slide > Box', 'Slide > Box > Shape', 'Slide > Box > Image']);
  });
});

// ───────────── erros ─────────────

describe('resolveDeck — errors', () => {
  it('throws when the root is not a Deck', () => {
    expectResolveError(<Slide />);
  });

  it('throws when the root component does not return a Deck', () => {
    const NotADeck = () => <Box />;
    expectResolveError(<NotADeck />);
  });

  it('throws when a Deck child is not a Slide', () => {
    expectResolveError(
      <Deck>
        <Box />
      </Deck>,
    );
  });

  it('throws when a Deck child component expands to something other than a Slide', () => {
    const Card = () => <Box />;
    expectResolveError(
      <Deck>
        <Card />
      </Deck>,
    );
  });

  it('throws on a loose string directly inside a Slide', () => {
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: 'loose' }) }));
  });

  it('throws on a loose string inside a Box', () => {
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Box, { children: 'loose' }) }) }));
  });

  it('throws on a loose number inside a Box', () => {
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Box, { children: 42 }) }) }));
  });

  it('throws on a loose string directly inside the Deck', () => {
    expectResolveError(jsx(Deck, { children: ['loose', jsx(Slide, {})] }));
  });

  it('throws on a string returned by a component outside Text', () => {
    const Label = (() => 'text') as unknown as Component;
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Label, {}) }) }));
  });

  it('throws on a primitive element inside Text', () => {
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Text, { children: ['a', jsx(Box, {})] }) }) }));
  });

  it('throws on a component element inside Text', () => {
    const Bold = () => <Text>b</Text>;
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Text, { children: jsx(Bold, {}) }) }) }));
  });

  it('throws when Image has children', () => {
    expectResolveError(
      jsx(Deck, { children: jsx(Slide, { children: jsx(Image, { src: 'a.png', children: jsx(Box, {}) }) }) }),
    );
  });

  it('throws when Shape has children', () => {
    expectResolveError(jsx(Deck, { children: jsx(Slide, { children: jsx(Shape, { kind: 'rect', children: 'x' }) }) }));
  });

  it('reports the path of the offending parent', () => {
    const CoverLayout = () => jsx(Slide, { children: jsx(Box, { children: 'loose' }) });
    const err = expectResolveError(jsx(Deck, { children: jsx(CoverLayout, {}) }));
    expect(err.path).toContain('CoverLayout');
  });
});
