import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/core/defaults.ts';
import type { ContainerBox, DeckDefinition, PositionedSlide, ResolvedDeck, ResolvedNode, SlideElement } from '../src/core/types.ts';
import { resolveWithContainers } from '../src/containers.ts';
import { layoutSlide } from '../src/layout/index.ts';
import { Box, Container, Deck, Slide, Text } from '../src/primitives/index.ts';
import { render } from '../src/render.ts';
import { resolveDeck } from '../src/resolve/index.ts';
import { createContext, resolveSize } from '../src/sizes.ts';
import demo from './examples/legacy/demo.tsx';
import hello from './examples/legacy/hello.tsx';
import { byPath, cssEnv, cssFit, emittedXmls, EXAMPLES_DIR, slideXmlsOf } from './helpers/css-fit.tsx';

/**
 * M19-4 (CONTRACTS.md, `Container`, Passadas e Custo zero): `resolveWithContainers` mede o espaço de cada Container
 * pendente com `layoutSlide` e resolve de novo; `render` usa as passadas. 16x9 = 720 × 405 pt, Slide sem padding.
 */

const SIZE = resolveSize('16x9');
const CTX = createContext(SIZE);
const ENV = cssEnv();

const contained = (root: SlideElement) => resolveWithContainers({ root, responsive: CTX, size: SIZE, layoutEnv: ENV });

const flattenResolved = (nodes: readonly ResolvedNode[]): readonly ResolvedNode[] =>
  nodes.flatMap((node) => [node, ...(node.kind === 'box' ? flattenResolved(node.children) : [])]);

const resolvedAt = (deck: ResolvedDeck, slide: number, path: string): ResolvedNode => {
  const found = flattenResolved(deck.slides[slide]!.children).find((node) => node.path === path);
  if (found === undefined) throw new Error(`no ${path}`);
  return found;
};

const containerState = (deck: ResolvedDeck, slide: number, path: string) => {
  const node = resolvedAt(deck, slide, path);
  return node.kind === 'box' ? node.container : undefined;
};

const round = (value: number) => Math.round(value * 100) / 100;
const frameOf = (slide: PositionedSlide, path: string) => {
  const { x, y, width, height } = byPath(slide, path).frame;
  return [x, y, width, height].map(round);
};

/** Guarda o último ContainerBox que cada função recebeu, por rótulo. */
const recorder = () => {
  const seen = new Map<string, ContainerBox>();
  const at = (label: string) => (box: ContainerBox) => {
    seen.set(label, box);
    return <Text>{label}</Text>;
  };
  const get = (label: string): ContainerBox => {
    const box = seen.get(label);
    if (box === undefined) throw new Error(`${label} not called`);
    return box;
  };
  return { at, get, seen };
};

const renderOne = async (deck: DeckDefinition) => {
  const [result] = await render(deck, { preview: false, includePositioned: true, embedFonts: false, baseDir: EXAMPLES_DIR });
  return result!;
};

describe('M19-4 — resolveWithContainers', () => {
  it('coluna 30% / resto: o Container recebe a content box do resto e o frame fica fixo', () => {
    const rec = recorder();
    const result = contained(
      <Deck>
        <Slide>
          <Box display="flex" flexDirection="row" flex={1}>
            <Box width="30%" />
            <Container flex={1} padding={10}>
              {rec.at('rest')}
            </Container>
          </Box>
        </Slide>
      </Deck>,
    );
    expect(result.diagnostics).toEqual([]);
    const box = rec.get('rest');
    // content box = frame (504 × 405) menos o padding de 10 pt de cada lado
    expect(round(box.width)).toBe(484);
    expect(round(box.height)).toBe(385);
    expect(box.narrow).toBe(false);
    expect(box.short).toBe(false);
    const node = resolvedAt(result.deck, 0, 'Slide > Box > Container');
    expect(node.kind === 'box' && node.container).toBe('measured');
    expect(round(node.css.width as number)).toBe(504);
    expect(node.css.height).toBe(405);
    expect(resolvedAt(result.deck, 0, 'Slide > Box > Container > Text').kind).toBe('text');
  });

  it('Container aninhado: o de dentro é medido numa passada a mais, com o espaço do de fora', () => {
    const rec = recorder();
    const result = contained(
      <Deck>
        <Slide>
          <Container flex={1} padding={20}>
            {() => (
              <Box display="flex" flexDirection="row" flex={1}>
                <Container flex={1}>{rec.at('left')}</Container>
                <Container flex={1}>{rec.at('right')}</Container>
              </Box>
            )}
          </Container>
        </Slide>
      </Deck>,
    );
    expect(result.diagnostics).toEqual([]);
    expect(containerState(result.deck, 0, 'Slide > Container')).toBe('measured');
    expect(containerState(result.deck, 0, 'Slide > Container > Box > Container[0]')).toBe('measured');
    expect(containerState(result.deck, 0, 'Slide > Container > Box > Container[1]')).toBe('measured');
    expect(round(rec.get('left').width)).toBe(340);
    expect(round(rec.get('left').height)).toBe(365);
    expect(round(rec.get('right').width)).toBe(340);
    expect(rec.get('left').narrow).toBe(true);
  });

  it('grade com 3 células: cada Container mede a sua trilha', () => {
    const rec = recorder();
    const result = contained(
      <Deck>
        <Slide>
          <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" width={600} height={200}>
            <Container>{rec.at('a')}</Container>
            <Container>{rec.at('b')}</Container>
            <Container>{rec.at('c')}</Container>
          </Box>
        </Slide>
      </Deck>,
    );
    expect(result.diagnostics).toEqual([]);
    for (const [index, label] of ['a', 'b', 'c'].entries()) {
      const box = rec.get(label);
      expect([round(box.width), round(box.height)]).toEqual([200, 200]);
      expect(box.narrow && box.short).toBe(true);
      expect(box.pick({ base: 'base', small: 'small' })).toBe('small');
      expect(containerState(result.deck, 0, `Slide > Box > Container[${index}]`)).toBe('measured');
    }
  });

  it('pai que depende do conteúdo: container-unsized (warning) e a função recebe 0', () => {
    const rec = recorder();
    const result = contained(
      <Deck>
        <Slide>
          <Text>antes</Text>
        </Slide>
        <Slide>
          <Box>
            <Container>{rec.at('zero')}</Container>
          </Box>
        </Slide>
      </Deck>,
    );
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'container-unsized', size: '16x9', slide: 2, path: 'Slide > Box > Container' }),
    ]);
    const box = rec.get('zero');
    expect(box.height).toBe(0);
    expect(box.short).toBe(true);
    expect(box.aspect).toBe(0);
  });

  /** n Containers aninhados; o mais interno devolve um Text. */
  const nested = (depth: number, rec: ReturnType<typeof recorder>): SlideElement => {
    const level = (n: number): SlideElement =>
      n === depth ? <Container flex={1}>{rec.at(`L${n}`)}</Container> : <Container flex={1}>{() => level(n + 1)}</Container>;
    return (
      <Deck>
        <Slide>{level(1)}</Slide>
      </Deck>
    );
  };
  const pathAt = (n: number) => ['Slide', ...Array.from({ length: n }, () => 'Container')].join(' > ');

  it(`${DEFAULTS.containerQuery.maxDepth} níveis aninhados: todos medidos, sem diagnóstico`, () => {
    const depth = DEFAULTS.containerQuery.maxDepth;
    const rec = recorder();
    const result = contained(nested(depth, rec));
    expect(result.diagnostics).toEqual([]);
    expect(containerState(result.deck, 0, pathAt(depth))).toBe('measured');
    expect(rec.seen.has(`L${depth}`)).toBe(true);
  });

  it('além de maxDepth: container-depth (error) no de dentro, que fica vazio', () => {
    const depth = DEFAULTS.containerQuery.maxDepth + 1;
    const rec = recorder();
    const result = contained(nested(depth, rec));
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ severity: 'error', code: 'container-depth', size: '16x9', slide: 1, path: pathAt(depth) }),
    ]);
    const inner = resolvedAt(result.deck, 0, pathAt(depth));
    expect(inner.kind === 'box' && inner.children).toEqual([]);
    expect(rec.seen.has(`L${depth}`)).toBe(false);
  });

  it('irmãos: paths e frames iguais aos da passada que mediu (o conteúdo não muda o espaço)', () => {
    const root = (
      <Deck>
        <Slide>
          <Text fontSize={20}>Título</Text>
          <Container flex={1} padding={8}>
            {() => (
              <Box display="flex" flexDirection="column" gap={10}>
                {Array.from({ length: 12 }, (_, i) => (
                  <Text fontSize={24}>
                    linha {i}
                  </Text>
                ))}
              </Box>
            )}
          </Container>
          <Text fontSize={14}>Rodapé</Text>
        </Slide>
      </Deck>
    );
    const first = layoutSlide(resolveDeck(root, CTX).slides[0]!, SIZE, ENV);
    const final = layoutSlide(contained(root).deck.slides[0]!, SIZE, ENV);
    for (const path of ['Slide > Text[0]', 'Slide > Container', 'Slide > Text[1]']) {
      expect(frameOf(final, path), path).toEqual(frameOf(first, path));
    }
    const top = (slide: PositionedSlide) => slide.children.map((node) => node.path);
    expect(top(final)).toEqual(top(first));
  });
});

describe('M19-4 — render com Container', () => {
  it('ponta a ponta: o conteúdo da função chega ao PPTX e os frames batem com a medida', async () => {
    const rec = recorder();
    const result = await renderOne(() => (
      <Deck>
        <Slide>
          <Box display="flex" flexDirection="row" flex={1}>
            <Box width="30%" />
            <Container flex={1}>{rec.at('ContainerConteudo')}</Container>
          </Box>
        </Slide>
      </Deck>
    ));
    expect(result.diagnostics.filter((d) => d.code.startsWith('container-'))).toEqual([]);
    const slide = result.positioned!.slides[0]!;
    expect(frameOf(slide, 'Slide > Box > Container')).toEqual([216, 0, 504, 405]);
    expect(byPath(slide, 'Slide > Box > Container > Text').kind).toBe('text');
    const [xml] = await slideXmlsOf(result.buffer);
    expect(xml).toContain('ContainerConteudo');
  });

  it('diagnósticos de Container: slide base 1 do autor e antes dos do fit', async () => {
    const result = await renderOne(() => (
      <Deck>
        <Slide>
          <Text>ok</Text>
        </Slide>
        <Slide>
          <Box width={60} height={20}>
            <Text fontSize={40} nowrap>
              Um texto que não cabe de jeito nenhum aqui dentro
            </Text>
          </Box>
          <Box>
            <Container>{() => <Text>x</Text>}</Container>
          </Box>
        </Slide>
      </Deck>
    ));
    const codes = result.diagnostics.map((d) => d.code);
    const unsized = result.diagnostics.find((d) => d.code === 'container-unsized');
    expect(unsized).toEqual(expect.objectContaining({ slide: 2, path: 'Slide > Box[1] > Container' }));
    const firstOther = codes.findIndex((code) => !code.startsWith('container-'));
    expect(firstOther, `diagnósticos: ${codes.join(', ')}`).toBeGreaterThan(-1);
    expect(codes.indexOf('container-unsized')).toBeLessThan(firstOther);
  });
});

describe('M19-4 — custo zero sem Container', () => {
  const DECKS: readonly (readonly [string, DeckDefinition])[] = [
    ['hello', hello],
    ['demo', demo],
  ];

  it.each(DECKS)('%s: resolveWithContainers = resolveDeck (deep equal), sem diagnósticos', (_, deck) => {
    const root = deck(CTX);
    const result = contained(root);
    expect(result.diagnostics).toEqual([]);
    expect(result.deck).toEqual(resolveDeck(deck(CTX), CTX));
  });

  it.each(DECKS)('%s: render dá o mesmo deck posicionado e o mesmo XML de slides que resolveDeck → fit → emit', async (_, deck) => {
    const result = await renderOne(deck);
    expect(result.positioned).toEqual(cssFit(deck, '16x9', EXAMPLES_DIR).positioned);
    expect(await slideXmlsOf(result.buffer)).toEqual(await emittedXmls(deck, '16x9', EXAMPLES_DIR));
  });
});
