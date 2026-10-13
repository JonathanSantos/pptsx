import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { render } from '../src/render.ts';
import { defineDeck } from '../src/index.ts';
import { resolveDeck } from '../src/resolve/index.ts';
import { createContext, parseSizeList, resolveSize } from '../src/sizes.ts';
import { Box, Deck, Slide, Text } from '../src/primitives/index.ts';
import type { DeckContext, ResolvedNode } from '../src/core/types.ts';

/** M5: responsividade via ctx (estrutura muda por tamanho) e RenderOptions.lang. */

const paths = (nodes: readonly ResolvedNode[]): string[] =>
  nodes.flatMap((node) => [node.path, ...('children' in node ? paths(node.children) : [])]);

const responsive = defineDeck((ctx: DeckContext) => (
  <Deck>
    <Slide padding={30}>
      <Box direction={ctx.aspect < 1.5 ? 'column' : 'row'} gap={16} grow={1}>
        <Text>Esquerda</Text>
        <Text>Direita</Text>
      </Box>
      {ctx.aspect < 1.5 ? <Text size={12}>Rodapé só no 4:3</Text> : null}
    </Slide>
  </Deck>
));

describe('sizes — custom', () => {
  it('parseSizeList + resolveSize: 10x7.5in → 720×540 named custom-10x7.5', () => {
    const [spec] = parseSizeList('10x7.5in');
    expect(resolveSize(spec!)).toEqual({ name: 'custom-10x7.5', width: 720, height: 540 });
  });

  it('custom 13.333x7.5in has the aspect of wide', () => {
    const ctx = createContext(resolveSize({ width: 13.333, height: 7.5 }));
    expect(ctx.aspect).toBeCloseTo(13.333 / 7.5, 6);
    expect(ctx.width).toBeCloseTo(960, 0);
  });
});

describe('ctx — scale', () => {
  it.each([
    ['16x9', 1],
    ['4x3', 1],
    ['wide', 4 / 3],
  ] as const)('%s → scale %d', (name, scale) => {
    expect(createContext(resolveSize(name)).scale).toBeCloseTo(scale, 10);
  });

  it('custom 5x5in: scale = min(360/720, 360/405) = 0.5', () => {
    expect(createContext(resolveSize({ width: 5, height: 5 })).scale).toBeCloseTo(0.5, 10);
  });

  it('a deck can use ctx.scale to size text', async () => {
    const deck = defineDeck((ctx: DeckContext) => (
      <Deck>
        <Slide>
          <Text size={Math.round(20 * ctx.scale)}>Escala</Text>
        </Slide>
      </Deck>
    ));
    const small = resolveDeck(deck(createContext(resolveSize({ width: 5, height: 2.8125 }))));
    const wide = resolveDeck(deck(createContext(resolveSize('wide'))));
    const sizeOf = (d: typeof small) => (d.slides[0]!.children[0] as { props: { size?: number } }).props.size;
    expect(sizeOf(small)).toBe(10);
    expect(sizeOf(wide)).toBe(27);
  });
});

describe('responsiveness — ctx.aspect changes the structure', () => {
  const resolvedAt = (name: '16x9' | '4x3') => resolveDeck(responsive(createContext(resolveSize(name))));

  it('16x9 and 4x3 resolve to different trees', () => {
    const wide = resolvedAt('16x9');
    const standard = resolvedAt('4x3');
    expect(wide).not.toEqual(standard);
    expect(paths(wide.slides[0]!.children)).toEqual(['Slide > Box', 'Slide > Box > Text[0]', 'Slide > Box > Text[1]']);
    expect(paths(standard.slides[0]!.children)).toEqual([
      'Slide > Box',
      'Slide > Box > Text[0]',
      'Slide > Box > Text[1]',
      'Slide > Text',
    ]);
  });

  it('direction is row in 16x9 and column in 4x3', () => {
    const boxOf = (name: '16x9' | '4x3') => resolvedAt(name).slides[0]!.children[0]!;
    expect(boxOf('16x9').props).toMatchObject({ direction: 'row' });
    expect(boxOf('4x3').props).toMatchObject({ direction: 'column' });
  });

  it('render() in both sizes positions the two texts side by side vs stacked', async () => {
    const results = await render(responsive, { sizes: ['16x9', '4x3'], preview: false });
    expect(results.map((r) => r.size)).toEqual(['16x9', '4x3']);
    const xml = async (buffer: Buffer) =>
      (await JSZip.loadAsync(buffer)).file('ppt/slides/slide1.xml')!.async('string');
    const [wideXml, standardXml] = await Promise.all(results.map((r) => xml(r.buffer)));
    expect(wideXml).not.toContain('Rodapé só no 4:3');
    expect(standardXml).toContain('Rodapé só no 4:3');
  }, 60_000);
});

describe('RenderOptions.lang', () => {
  const deck = defineDeck(() => (
    <Deck>
      <Slide padding={30}>
        <Text>Olá</Text>
        <Text weight="bold">Mundo</Text>
      </Slide>
    </Deck>
  ));

  const slideXml = async (lang?: string): Promise<string> => {
    const [result] = await render(deck, { preview: false, ...(lang ? { lang } : {}) });
    return (await JSZip.loadAsync(result!.buffer)).file('ppt/slides/slide1.xml')!.async('string');
  };

  const langsOf = (xml: string): string[] => [...xml.matchAll(/<a:rPr[^>]*\blang="([^"]+)"/g)].map((m) => m[1]!);

  it('default lang is pt-BR on every run', async () => {
    const langs = langsOf(await slideXml());
    expect(langs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(langs)).toEqual(new Set(['pt-BR']));
  }, 60_000);

  it("lang 'en-US' replaces pt-BR on every run", async () => {
    const xml = await slideXml('en-US');
    const langs = langsOf(xml);
    expect(langs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(langs)).toEqual(new Set(['en-US']));
    expect(xml).not.toContain('lang="pt-BR"');
  }, 60_000);
});
