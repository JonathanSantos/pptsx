import { describe, expect, it } from 'vitest';
import { Box, Connector, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { ResolveError, resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { ResolvedNode, SlideElement } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

/**
 * M19 (CONTRACTS.md, Connector): escopo de ids. O escopo de um nó é a instância de componente mais próxima;
 * repetições em instâncias diferentes viram `id#2`, `id#3`… e `from`/`to` são reescritos para a própria instância.
 */

const ctx = createContext(resolveSize('16x9'));
const resolve = (children: unknown) => resolveDeck((<Deck><Slide>{children as SlideElement}</Slide></Deck>) as SlideElement, ctx);

const idsOf = (nodes: readonly ResolvedNode[]): readonly [string, string][] =>
  nodes.flatMap((node) => [
    ...(node.props.id === undefined ? [] : [[node.path, node.props.id] as [string, string]]),
    ...(node.kind === 'box' ? idsOf(node.children) : []),
  ]);

/** Componente (função) com dois nós de id fixo e um conector entre eles. */
const Flow = ({ left = 0 }: { readonly left?: number }) => (
  <Box position="absolute" left={left} top={100} width={300} height={50}>
    <Box id="a" position="absolute" left={0} top={0} width={100} height={50} />
    <Box id="b" position="absolute" left={200} top={0} width={100} height={50} />
    <Connector from="a" to="b" />
  </Box>
);

describe('M19 — escopo de ids de conector (resolve)', () => {
  it('componente repetido 2×: resolve sem erro e cada conector liga a própria instância', () => {
    const slide = resolve(<><Flow /><Flow left={350} /></>).slides[0]!;
    expect(idsOf(slide.children)).toEqual([
      ['Slide > Flow[0] > Box[0]', 'a'],
      ['Slide > Flow[0] > Box[1]', 'b'],
      ['Slide > Flow[1] > Box[0]', 'a#2'],
      ['Slide > Flow[1] > Box[1]', 'b#2'],
    ]);
    expect(slide.connectors!.map((c) => [c.path, c.props.from, c.props.to])).toEqual([
      ['Slide > Flow[0] > Connector', 'a', 'b'],
      ['Slide > Flow[1] > Connector', 'a#2', 'b#2'],
    ]);
    expect(slide.connectors!.every((c) => c.missing === undefined)).toBe(true);
  });

  it('Connector no nível do slide para um id repetido em duas instâncias → ResolveError "ambíguo"', () => {
    const run = () => resolve(<><Flow /><Flow left={350} /><Connector from="a" to="b" /></>);
    expect(run).toThrow(ResolveError);
    expect(run).toThrow(/id "a" ambíguo/);
  });

  it('mesmo id duas vezes na mesma instância → ResolveError "repetido no slide"', () => {
    const Twice = () => (
      <Box>
        <Box id="x" />
        <Box id="x" />
      </Box>
    );
    expect(() => resolve(<Twice />)).toThrow(ResolveError);
    expect(() => resolve(<Twice />)).toThrow(/id "x" repetido no slide/);
  });

  it('ids únicos no slide saem exatamente como o autor escreveu (sem sufixo)', () => {
    const One = () => (
      <Box>
        <Box id="p" />
        <Box id="q" />
        <Connector from="p" to="q" />
      </Box>
    );
    const slide = resolve(<><One /><Text id="t">x</Text><Connector from="p" to="t" /></>).slides[0]!;
    expect(idsOf(slide.children).map(([, id]) => id)).toEqual(['p', 'q', 't']);
    expect(slide.connectors!.map((c) => [c.props.from, c.props.to])).toEqual([['p', 'q'], ['p', 't']]);
  });

  it('irmãos sem componente com o mesmo id continuam erro (escopo = slide)', () => {
    expect(() => resolve(<><Box id="a" /><Text id="a">x</Text></>)).toThrow(/id "a" repetido no slide \(já usado em Slide > Box\)/);
  });
});

describe('M19 — escopo de ids de conector (fit)', () => {
  it('cada conector é desenhado entre os nós da própria instância', async () => {
    const { diagnostics, positioned } = await build(
      <Deck>
        <Slide>
          <Flow />
          <Flow left={350} />
        </Slide>
      </Deck>,
    );
    expect(diagnostics.filter((d) => d.code.startsWith('connector'))).toEqual([]);
    const connectors = positioned.slides[0]!.connectors!;
    expect(connectors.map((c) => [c.props.from, c.props.to])).toEqual([['a', 'b'], ['a#2', 'b#2']]);
    expect(connectors[0]!.points).toEqual([{ x: 100, y: 125 }, { x: 200, y: 125 }]);
    expect(connectors[1]!.points).toEqual([{ x: 450, y: 125 }, { x: 550, y: 125 }]);
  });
});
