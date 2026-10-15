import { describe, expect, it } from 'vitest';
import type {
  DeckContext,
  ResolvedBox,
  ResolvedDeck,
  ResolvedNode,
  ResolvedSlide,
  ResolvedText,
  Responsive,
  SizeSpec,
  SlideElement,
} from '../../src/core/types.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { ResolveError, resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';

/** CONTRACTS §M9 "src/resolve/ (M9-A)": props responsivas resolvidas por tamanho e validação de paginate. */

const ctxOf = (spec: SizeSpec): DeckContext => createContext(resolveSize(spec));
const CTX_16X9 = ctxOf('16x9');
const CTX_4X3 = ctxOf('4x3');
const CTX_WIDE = ctxOf('wide');
const CTX_CUSTOM_TALL = ctxOf({ width: 10, height: 7.5 });

const resolveAt = (slide: SlideElement, ctx: DeckContext = CTX_16X9): ResolvedSlide => {
  const first = resolveDeck(<Deck>{slide}</Deck>, ctx).slides[0];
  if (!first) throw new Error('no slide');
  return first;
};

const descendants = (nodes: readonly ResolvedNode[]): ResolvedNode[] =>
  nodes.flatMap((node) => [node, ...('children' in node ? descendants(node.children) : [])]);

const nodeAt = (slide: ResolvedSlide, path: string): ResolvedNode => {
  const node = descendants(slide.children).find((n) => n.path === path);
  if (!node) throw new Error(`no node at ${path}; have ${descendants(slide.children).map((n) => n.path).join(', ')}`);
  return node;
};

const firstText = (slide: ResolvedSlide): ResolvedText => {
  const text = descendants(slide.children).find((n): n is ResolvedText => n.kind === 'text');
  if (!text) throw new Error('no text');
  return text;
};

const resolveErrorOf = (run: () => unknown): ResolveError => {
  let caught: unknown;
  try {
    run();
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ResolveError);
  return caught as ResolveError;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Pares [path, prop] cujo valor ainda é um objeto responsivo (com `base`). */
const responsiveLeftovers = (deck: ResolvedDeck): string[] =>
  deck.slides.flatMap((slide) =>
    [slide, ...descendants(slide.children)].flatMap((node) =>
      Object.entries(node.props as Record<string, unknown>)
        .filter(([, value]) => isRecord(value) && Object.hasOwn(value, 'base'))
        .map(([key]) => `${node.path}.${key}`),
    ),
  );

// ───────────── resolução por tamanho ─────────────

describe('resolveDeck — responsive props by size', () => {
  const slide = (
    <Slide>
      <Text fontSize={{ base: 20, tall: 24, '4x3': 26 }}>x</Text>
    </Slide>
  );

  it.each([
    ['4x3 → exact name', CTX_4X3, 26],
    ['16x9 → base', CTX_16X9, 20],
    ['custom 10x7.5in → tall', CTX_CUSTOM_TALL, 24],
    ['wide → base (no wide key)', CTX_WIDE, 20],
  ] as const)('%s', (_, ctx, expected) => {
    expect(firstText(resolveAt(slide, ctx)).props.size).toBe(expected);
  });

  it('resolved tree has only concrete values', () => {
    const deck = resolveDeck(
      <Deck>
        <Slide
          padding={{ base: 24, tall: 32 }}
          gap={{ base: 8, wide: 12 }}
          background={{ base: '#ffffff', tall: '#eeeeee' }}
          flexDirection={{ base: 'column', tall: 'column' }}
        >
          <Box display="flex" flexDirection={{ base: 'row', tall: 'column' }} gap={{ base: 10, tall: 20 }} backgroundColor={{ base: '#ff0000', wide: '#00ff00' }} flex={{ base: 1 }}>
            <Text fontSize={{ base: 20, tall: 24 }} color={{ base: '#111111', tall: '#222222' }} fontWeight={{ base: 'regular', wide: 'bold' }} fit={{ base: 'shrink', tall: 'truncate' }}>
              a
            </Text>
            <Image src="x.png" width={{ base: 100, tall: 200 }} objectFit={{ base: 'contain', tall: 'cover' }} />
            <Shape kind="rect" width={{ base: 10, tall: 20 }} height={{ base: 10 }} radius={{ base: 0, tall: 4 }} />
          </Box>
        </Slide>
      </Deck>,
      CTX_4X3,
    );
    expect(responsiveLeftovers(deck)).toEqual([]);
    const slide = deck.slides[0]!;
    // M16: a geometria fica só no css (padding nos 4 lados; o fill do Box é css.backgroundColor).
    expect(slide.css).toMatchObject({ padding: { top: 32, right: 32, bottom: 32, left: 32 }, rowGap: 8, backgroundColor: '#EEEEEE', flexDirection: 'column' });
    expect(nodeAt(slide, 'Slide > Box').css).toMatchObject({ flexDirection: 'column', rowGap: 20, flexGrow: 1 });
    expect(nodeAt(slide, 'Slide > Box').css).toMatchObject({ backgroundColor: '#FF0000' });
    expect(nodeAt(slide, 'Slide > Box > Text').props).toMatchObject({ size: 24, color: '#222222', weight: 'regular', fit: 'truncate' });
    expect(nodeAt(slide, 'Slide > Box > Image').props).toMatchObject({ src: 'x.png', fit: 'cover' });
    expect(nodeAt(slide, 'Slide > Box > Image').css).toMatchObject({ width: 200 });
    expect(nodeAt(slide, 'Slide > Box > Shape').props).toMatchObject({ kind: 'rect', radius: 4 });
    expect(nodeAt(slide, 'Slide > Box > Shape').css).toMatchObject({ width: 20, height: 10 });
  });

  it('the same deck resolves differently in 16x9', () => {
    const slide = resolveAt(
      <Slide>
        <Box display="flex" flexDirection={{ base: 'row', tall: 'column' }}>
          <Text fontSize={{ base: 20, wide: 28 }}>a</Text>
        </Box>
      </Slide>,
      CTX_16X9,
    );
    expect(nodeAt(slide, 'Slide > Box').css).toMatchObject({ flexDirection: 'row' });
    expect(nodeAt(slide, 'Slide > Box > Text').props).toMatchObject({ size: 20 });
  });

  it('wide preset picks wide values', () => {
    const slide = resolveAt(
      <Slide>
        <Text fontSize={{ base: 20, tall: 24, wide: 28 }}>a</Text>
      </Slide>,
      CTX_WIDE,
    );
    expect(firstText(slide).props.size).toBe(28);
  });

  it('a responsive value inside a Box padding object is resolved as a whole', () => {
    const slide = resolveAt(
      <Slide>
        <Box padding={{ base: { top: 4 }, tall: { top: 8, bottom: 8 } }} />
      </Slide>,
      CTX_4X3,
    );
    expect((nodeAt(slide, 'Slide > Box') as ResolvedBox).css.padding).toEqual({ top: 8, right: 0, bottom: 8, left: 0 });
  });
});

// ───────────── objetos que não são responsivos ─────────────

describe('resolveDeck — non-responsive objects pass intact', () => {
  it('padding={{ top: 10 }} is kept', () => {
    for (const ctx of [CTX_16X9, CTX_4X3]) {
      const slide = resolveAt(
        <Slide padding={{ top: 10 }}>
          <Box padding={{ top: 10, left: 4 }} />
        </Slide>,
        ctx,
      );
      // Lados ausentes valem 0 no css (o objeto em si não é responsivo).
      expect(slide.css.padding).toEqual({ top: 10, right: 0, bottom: 0, left: 0 });
      expect((nodeAt(slide, 'Slide > Box') as ResolvedBox).css.padding).toEqual({ top: 10, right: 0, bottom: 0, left: 4 });
    }
  });

  it("background={{ image: 'x.png' }} is kept", () => {
    const slide = resolveAt(<Slide backgroundImage="url(x.png)" />, CTX_4X3);
    expect(slide.css.backgroundImage).toBe('x.png');
  });

  it('notes and src are never touched', () => {
    const slide = resolveAt(
      <Slide notes="nota do apresentador">
        <Image src="logo.png" />
      </Slide>,
      CTX_4X3,
    );
    expect(slide.props.notes).toBe('nota do apresentador');
    expect(nodeAt(slide, 'Slide > Image').props).toMatchObject({ src: 'logo.png' });
  });
});

// ───────────── undefined ─────────────

describe('resolveDeck — values that resolve to undefined', () => {
  it('{ base: undefined, tall: 5 } in 16x9 omits the prop', () => {
    const size = { base: undefined, tall: 5 } as unknown as Responsive<number>;
    const text = firstText(resolveAt(<Slide><Text fontSize={size}>x</Text></Slide>, CTX_16X9));
    expect(Object.hasOwn(text.props, 'size')).toBe(false);
  });

  it('{ base: undefined, tall: 5 } in 4x3 → 5', () => {
    const size = { base: undefined, tall: 5 } as unknown as Responsive<number>;
    expect(firstText(resolveAt(<Slide><Text fontSize={size}>x</Text></Slide>, CTX_4X3)).props.size).toBe(5);
  });

  it('omitted prop resolves like an unwritten one (default applies downstream)', () => {
    const size = { base: undefined } as unknown as Responsive<number>;
    const withUndefined = firstText(resolveAt(<Slide><Text fontSize={size}>x</Text></Slide>));
    const without = firstText(resolveAt(<Slide><Text>x</Text></Slide>));
    expect(withUndefined.props).toEqual(without.props);
  });
});

// ───────────── malformados (JS sem tipos) ─────────────

describe('resolveDeck — malformed responsive objects', () => {
  it('a malformed responsive value inside style → ResolveError (M11)', () => {
    expect(() => resolveAt(<Slide><Box style={{ marginTop: { tall: 8 } } as never} /></Slide>)).toThrow(ResolveError);
  });

  it('a responsive value inside style resolves per size (M11)', () => {
    const el = <Slide><Box height={10} style={{ marginTop: { base: 4, tall: 8 } }} /></Slide>;
    expect(nodeAt(resolveAt(el, CTX_16X9), 'Slide > Box').css.margin.top).toBe(4);
    expect(nodeAt(resolveAt(el, CTX_4X3), 'Slide > Box').css.margin.top).toBe(8);
  });

  it('object without base → ResolveError naming the prop and the path', () => {
    const error = resolveErrorOf(() =>
      resolveAt(
        <Slide>
          <Box>
            <Text fontSize={{ tall: 24 } as never}>x</Text>
          </Box>
        </Slide>,
      ),
    );
    expect(error.path).toBe('Slide > Box > Text');
    expect(error.message).toContain('Prop "fontSize"');
    expect(error.message).toContain('objeto responsivo sem a chave "base"');
    expect(error.message).toContain('Slide > Box > Text');
  });

  it('unknown breakpoint key → ResolveError', () => {
    const error = resolveErrorOf(() => resolveAt(<Slide><Text fontSize={{ base: 20, tal: 24 } as never}>x</Text></Slide>));
    expect(error.path).toBe('Slide > Text');
    expect(error.message).toContain('Prop "fontSize"');
    expect(error.message).toContain('breakpoint desconhecido: "tal"');
  });

  it('message names the primitive', () => {
    const error = resolveErrorOf(() => resolveAt(<Slide><Box gap={{ wide: 4 } as never} /></Slide>));
    expect(error.message).toContain('Prop "gap"');
    expect(error.message).toContain('Box');
    expect(error.path).toBe('Slide > Box');
  });

  it('is validated even when the active size would not need the value', () => {
    // A validação é por prop, não por tamanho: o objeto está errado em qualquer tamanho.
    for (const ctx of [CTX_16X9, CTX_4X3]) {
      expect(() => resolveAt(<Slide><Text fontSize={{ tall: 24 } as never}>x</Text></Slide>, ctx)).toThrow(ResolveError);
    }
  });

  it('a malformed Slide prop is reported at the slide path', () => {
    const error = resolveErrorOf(() => resolveAt(<Slide gap={{ '4x3': 4 } as never} />));
    expect(error.path).toBe('Slide');
    expect(error.message).toContain('Prop "gap"');
  });
});

// ───────────── componentes do usuário ─────────────

describe('resolveDeck — user components forward responsive values', () => {
  const Bullets = (props: { size: Responsive<number>; gap?: Responsive<number>; items: readonly string[] }) => (
    <Box gap={props.gap}>
      {props.items.map((item) => (
        <Text fontSize={props.size}>{item}</Text>
      ))}
    </Box>
  );

  it('forwards size to Text and resolves at the primitive', () => {
    const slide = (
      <Slide>
        <Bullets size={{ base: 20, wide: 24, tall: 22 }} gap={{ base: 8, tall: 12 }} items={['a', 'b']} />
      </Slide>
    );
    const sizesAt = (ctx: DeckContext) =>
      descendants(resolveAt(slide, ctx).children)
        .filter((n): n is ResolvedText => n.kind === 'text')
        .map((t) => t.props.size);
    expect(sizesAt(CTX_16X9)).toEqual([20, 20]);
    expect(sizesAt(CTX_WIDE)).toEqual([24, 24]);
    expect(sizesAt(CTX_4X3)).toEqual([22, 22]);
    expect(nodeAt(resolveAt(slide, CTX_4X3), 'Slide > Bullets').css).toMatchObject({ rowGap: 12 });
  });

  it('component paths do not change with responsive values', () => {
    const slide = (
      <Slide>
        <Bullets size={{ base: 20, tall: 22 }} items={['a', 'b']} />
      </Slide>
    );
    const pathsAt = (ctx: DeckContext) => descendants(resolveAt(slide, ctx).children).map((n) => n.path);
    expect(pathsAt(CTX_4X3)).toEqual(pathsAt(CTX_16X9));
    expect(pathsAt(CTX_16X9)).toEqual(['Slide > Bullets', 'Slide > Bullets > Text[0]', 'Slide > Bullets > Text[1]']);
  });
});

// ───────────── tipos ─────────────

describe('responsive props — types', () => {
  it('rejects objects without base and responsive src/kind/notes at compile time', () => {
    const build = () => (
      <Deck>
        {/* @ts-expect-error objeto responsivo exige base */}
        <Slide gap={{ tall: 4 }}>
          {/* @ts-expect-error objeto responsivo exige base */}
          <Text fontSize={{ tall: 24 }}>x</Text>
          {/* @ts-expect-error src não é responsivo */}
          <Image src={{ base: 'a.png', tall: 'b.png' }} />
          {/* @ts-expect-error kind não é responsivo */}
          <Shape kind={{ base: 'rect', tall: 'ellipse' }} />
        </Slide>
        {/* @ts-expect-error notes não é responsivo */}
        <Slide notes={{ base: 'a', tall: 'b' }} />
      </Deck>
    );
    expect(typeof build).toBe('function');
  });

  it('accepts responsive values on regular props', () => {
    const value: Responsive<number> = { base: 1, tall: 2, wide: 3, '4x3': 4, 'custom-10x7.5': 5 };
    const element = (
      <Slide padding={{ base: 10, tall: { top: 4 } }} background={{ base: '#ffffff', tall: 'url(x.png)' }}>
        <Box paginate={{ base: false, tall: true }} width={{ base: '50%', tall: '100%' }} />
        <Text fontSize={value}>x</Text>
      </Slide>
    );
    expect(element).toBeDefined();
  });
});

// ───────────── paginate ─────────────

describe('resolveDeck — paginate validation', () => {
  it('two <Box paginate> in the same slide → ResolveError at the second', () => {
    const error = resolveErrorOf(() =>
      resolveAt(
        <Slide>
          <Box paginate />
          <Box paginate />
        </Slide>,
      ),
    );
    expect(error.message).toContain('Só um <Box paginate> por slide; encontrados 2');
    expect(error.path).toBe('Slide > Box[1]');
  });

  it('nested paginate boxes also count', () => {
    const error = resolveErrorOf(() =>
      resolveAt(
        <Slide>
          <Box paginate>
            <Box paginate />
          </Box>
        </Slide>,
      ),
    );
    expect(error.message).toContain('Só um <Box paginate> por slide');
    expect(error.path).toBe('Slide > Box > Box');
  });

  it('paginate on different slides is fine', () => {
    const deck = resolveDeck(
      <Deck>
        <Slide>
          <Box paginate />
        </Slide>
        <Slide>
          <Box paginate />
        </Slide>
      </Deck>,
      CTX_16X9,
    );
    expect(deck.slides).toHaveLength(2);
  });

  it('paginate on an absolute Box → ResolveError', () => {
    const error = resolveErrorOf(() => resolveAt(<Slide><Box paginate position="absolute" /></Slide>));
    expect(error.path).toBe('Slide > Box');
    expect(error.message).toContain('paginate');
    expect(error.message).toContain('absolute');
  });

  it('a single paginate is kept in props.paginate', () => {
    const slide = resolveAt(
      <Slide>
        <Box paginate>
          <Text>a</Text>
        </Box>
      </Slide>,
    );
    expect((nodeAt(slide, 'Slide > Box') as ResolvedBox).props.paginate).toBe(true);
  });

  it('responsive paginate counts only where it resolves to true', () => {
    const slide = (
      <Slide>
        <Box paginate={{ base: false, tall: true }} />
        <Box paginate={{ base: false, tall: true }} />
      </Slide>
    );
    expect(() => resolveAt(slide, CTX_16X9)).not.toThrow();
    expect(() => resolveAt(slide, CTX_4X3)).toThrow(ResolveError);
  });

  it('paginate={false} twice is fine', () => {
    expect(() =>
      resolveAt(
        <Slide>
          <Box paginate={false} />
          <Box paginate={false} />
        </Slide>,
      ),
    ).not.toThrow();
  });
});

describe('resolveDeck — sourceSlide', () => {
  it('is the 1-based index in the author deck', () => {
    const deck = resolveDeck(
      <Deck>
        <Slide />
        <Slide />
        <Slide />
      </Deck>,
      CTX_16X9,
    );
    expect(deck.slides.map((s) => s.sourceSlide)).toEqual([1, 2, 3]);
  });
});
