import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { ContainerBox, ContainerResponsive, ResolvedBox, ResolvedNode, ResolvedSlide, SlideElement } from '../../src/core/types.ts';
import { Box, Container, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { ResolveError, containerKeyOf, resolveDeck, type ContainerMeasure, type ContainerMeasures } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';

/**
 * M19-4 (CONTRACTS.md, `Container`): o Container vira um ResolvedBox; sem medida fica `pending` e vazio; com medida
 * a função recebe o ContainerBox (content box, narrow/short, aspect, pick, slide) e o Box fixa o frame medido.
 */

const CTX = createContext(resolveSize('16x9'));
const PATH = 'Slide > Container';

const measureOf = (frame: readonly [number, number], content: readonly [number, number] = frame): ContainerMeasure => ({
  frame: { width: frame[0], height: frame[1] },
  content: { width: content[0], height: content[1] },
});

const measures = (entries: readonly (readonly [number, string, ContainerMeasure])[]): ContainerMeasures =>
  new Map(entries.map(([slide, path, measure]) => [containerKeyOf(slide, path), measure] as const));

const resolveOne = (slide: SlideElement, containers?: ContainerMeasures): ResolvedSlide => {
  const first = resolveDeck(<Deck>{slide}</Deck>, CTX, undefined, containers).slides[0];
  if (first === undefined) throw new Error('no slide');
  return first;
};

const flatten = (nodes: readonly ResolvedNode[]): readonly ResolvedNode[] =>
  nodes.flatMap((node) => [node, ...(node.kind === 'box' ? flatten(node.children) : [])]);

const byPath = (slide: ResolvedSlide, path: string): ResolvedNode => {
  const found = flatten(slide.children).find((node) => node.path === path);
  if (found === undefined) throw new Error(`no ${path}: ${flatten(slide.children).map((n) => n.path).join(', ')}`);
  return found;
};

const asBox = (node: ResolvedNode): ResolvedBox => {
  if (node.kind !== 'box') throw new Error(`${node.path} is ${node.kind}`);
  return node;
};

/** Resolve um Container com a medida dada e devolve o ContainerBox que a função recebeu. */
const boxFor = (content: readonly [number, number]): ContainerBox => {
  let received: ContainerBox | undefined;
  resolveOne(
    <Slide>
      <Container flex={1}>
        {(box) => {
          received = box;
          return <Text>x</Text>;
        }}
      </Container>
    </Slide>,
    measures([[0, PATH, measureOf(content)]]),
  );
  if (received === undefined) throw new Error('function not called');
  return received;
};

const expectResolveError = (slide: SlideElement, containers?: ContainerMeasures): ResolveError => {
  let caught: unknown;
  try {
    resolveOne(slide, containers);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ResolveError);
  return caught as ResolveError;
};

describe('M19-4 — Container no resolve', () => {
  it('filho que não é função → ResolveError "precisa de uma função como filho"', () => {
    const bad = { children: <Text>x</Text> } as unknown as Parameters<typeof Container>[0];
    const error = expectResolveError(
      <Slide>
        <Container {...bad} />
      </Slide>,
    );
    expect(error.message).toContain('precisa de uma função como filho');
    expect(error.path).toBe(PATH);
  });

  it('filho não-função também falha com medida disponível', () => {
    const bad = { children: 'texto' } as unknown as Parameters<typeof Container>[0];
    expectResolveError(
      <Slide>
        <Container {...bad} flex={1} />
      </Slide>,
      measures([[0, PATH, measureOf([100, 100])]]),
    );
  });

  it('sem medida: ResolvedBox `pending` sem filhos e a função não é chamada', () => {
    let calls = 0;
    const slide = resolveOne(
      <Slide>
        <Container flex={1} padding={10}>
          {() => {
            calls += 1;
            return <Text>x</Text>;
          }}
        </Container>
      </Slide>,
    );
    const node = asBox(byPath(slide, PATH));
    expect(node.kind).toBe('box');
    expect(node.container).toBe('pending');
    expect(node.children).toEqual([]);
    expect(calls).toBe(0);
  });

  it('com medida: a função recebe a content box; o Box fixa o frame, flex 0 e vira `measured`', () => {
    let received: ContainerBox | undefined;
    const slide = resolveOne(
      <Slide>
        <Container flex={1} padding={10}>
          {(box) => {
            received = box;
            return (
              <>
                <Text>a</Text>
                <Box>
                  <Text>b</Text>
                </Box>
              </>
            );
          }}
        </Container>
      </Slide>,
      measures([[0, PATH, measureOf([600, 300], [580, 280])]]),
    );
    expect(received).toBeDefined();
    const box = received!;
    expect(box.width).toBe(580);
    expect(box.height).toBe(280);
    expect(box.aspect).toBeCloseTo(580 / 280, 10);
    expect(box.narrow).toBe(false);
    expect(box.short).toBe(false);
    expect(box.slide.name).toBe('16x9');
    expect(box.slide.aspect).toBe(CTX.aspect);
    expect(typeof box.slide.pick).toBe('function');

    const node = asBox(byPath(slide, PATH));
    expect(node.container).toBe('measured');
    expect(node.css.width).toBe(600);
    expect(node.css.height).toBe(300);
    expect(node.css.flexGrow).toBe(0);
    expect(node.css.flexShrink).toBe(0);
    expect(node.css.flexBasis).toBe('auto');
    expect(flatten(node.children).map((child) => child.path)).toEqual([
      'Slide > Container > Text',
      'Slide > Container > Box',
      'Slide > Container > Box > Text',
    ]);
    const text = byPath(slide, 'Slide > Container > Text');
    expect(text.kind).toBe('text');
  });

  it('narrow/short pelos limites de DEFAULTS.containerQuery (igual ao limite = falso; abaixo = verdadeiro)', () => {
    const { narrow, short } = DEFAULTS.containerQuery;
    const atLimit = boxFor([narrow, short]);
    expect(atLimit.narrow).toBe(false);
    expect(atLimit.short).toBe(false);
    const below = boxFor([narrow - 0.01, short - 0.01]);
    expect(below.narrow).toBe(true);
    expect(below.short).toBe(true);
    const onlyNarrow = boxFor([narrow - 1, short + 1]);
    expect([onlyNarrow.narrow, onlyNarrow.short]).toEqual([true, false]);
    const onlyShort = boxFor([narrow + 1, short - 1]);
    expect([onlyShort.narrow, onlyShort.short]).toEqual([false, true]);
  });

  it('aspect = 0 quando a altura é 0', () => {
    const box = boxFor([300, 0]);
    expect(box.height).toBe(0);
    expect(box.aspect).toBe(0);
  });

  it('a chave usa o índice do slide do autor (base 0): só o slide com medida é `measured`', () => {
    const deck = (
      <Deck>
        <Slide>
          <Container flex={1}>{() => <Text>a</Text>}</Container>
        </Slide>
        <Slide>
          <Container flex={1}>{() => <Text>b</Text>}</Container>
        </Slide>
      </Deck>
    );
    const resolved = resolveDeck(deck, CTX, undefined, measures([[1, PATH, measureOf([200, 100])]]));
    expect(asBox(byPath(resolved.slides[0]!, PATH)).container).toBe('pending');
    const second = asBox(byPath(resolved.slides[1]!, PATH));
    expect(second.container).toBe('measured');
    expect(second.children).toHaveLength(1);
  });

  it('Container dentro de Box paginate → ResolveError (com e sem medida)', () => {
    const slide = (
      <Slide>
        <Box paginate flex={1}>
          <Container flex={1}>{() => <Text>x</Text>}</Container>
        </Box>
      </Slide>
    );
    expectResolveError(slide);
    expectResolveError(slide, measures([[0, 'Slide > Box > Container', measureOf([300, 300])]]));
  });

  it('Container aninhado em Box paginate mais fundo também falha', () => {
    expectResolveError(
      <Slide>
        <Box paginate flex={1}>
          <Box>
            <Container flex={1}>{() => <Text>x</Text>}</Container>
          </Box>
        </Box>
      </Slide>,
    );
  });
});

describe('M19-4 — ContainerBox.pick', () => {
  const V: ContainerResponsive<string> = { base: 'base', narrow: 'narrow', short: 'short', small: 'small' };
  const { narrow, short } = DEFAULTS.containerQuery;
  const wide = narrow + 100;
  const tall = short + 100;
  const thin = narrow - 100;
  const low = short - 100;

  it('nem narrow nem short: base', () => {
    expect(boxFor([wide, tall]).pick(V)).toBe('base');
  });

  it('só narrow: narrow', () => {
    expect(boxFor([thin, tall]).pick(V)).toBe('narrow');
  });

  it('só short: short', () => {
    expect(boxFor([wide, low]).pick(V)).toBe('short');
  });

  it('os dois: small', () => {
    expect(boxFor([thin, low]).pick(V)).toBe('small');
  });

  it('os dois sem small: cai para narrow', () => {
    expect(boxFor([thin, low]).pick({ base: 'base', narrow: 'narrow', short: 'short' })).toBe('narrow');
  });

  it('os dois só com short: short', () => {
    expect(boxFor([thin, low]).pick({ base: 'base', short: 'short' })).toBe('short');
  });

  it('os dois sem nenhum breakpoint: base', () => {
    expect(boxFor([thin, low]).pick({ base: 'base' })).toBe('base');
  });

  it('com um só (narrow): o valor sem narrow volta para base, mesmo com short/small', () => {
    expect(boxFor([thin, tall]).pick({ base: 'base', short: 'short', small: 'small' })).toBe('base');
  });

  it('com um só (short): o valor sem short volta para base, mesmo com narrow/small', () => {
    expect(boxFor([wide, low]).pick({ base: 'base', narrow: 'narrow', small: 'small' })).toBe('base');
  });

  it('valor não responsivo volta como veio', () => {
    const box = boxFor([thin, low]);
    expect(box.pick(42)).toBe(42);
    expect(box.pick<string>('texto')).toBe('texto');
    const list = [1, 2, 3];
    expect(box.pick(list)).toBe(list);
    const plain = { narrow: 'sem base' };
    expect(box.pick(plain as unknown as ContainerResponsive<string>)).toBe(plain);
  });
});
