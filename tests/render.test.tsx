import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { render } from '../src/render.ts';
import { defineDeck } from '../src/index.ts';
import { Box, Deck, Slide, Text } from '../src/primitives/index.ts';
import type { DeckContext, LineBreaks, PositionedNode, RenderResult } from '../src/core/types.ts';
import { isPng, pngSize } from './helpers/png.ts';
import { expectFrame } from './helpers/positioned.ts';

/** Integração: deck JSX pequeno → render() em dois tamanhos. */
const Title = (props: { readonly children: string }) => (
  <Text size={32} weight="bold">
    {props.children}
  </Text>
);

const deck = defineDeck((ctx: DeckContext) => (
  <Deck>
    <Slide padding={36} background="#FFFFFF">
      <Title>Título com acentuação</Title>
      <Text size={18}>{`Tamanho ${ctx.name}: texto que pode quebrar em mais de uma linha dependendo da largura.`}</Text>
    </Slide>
    <Slide padding={36} direction="row" gap={20}>
      <Box grow={1} fill="#EEEEEE" padding={10}>
        <Text>Coluna A</Text>
      </Box>
      <Box grow={1} fill="#DDDDDD" padding={10}>
        <Text italic>Coluna B</Text>
      </Box>
    </Slide>
  </Deck>
));

const SLIDE_COUNT = 2;

const isZip = (buffer: Buffer): boolean => buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;

describe('render — integration', () => {
  it('renders 16x9 and 4x3 with preview', async () => {
    const results = await render(deck, { sizes: ['16x9', '4x3'], preview: { mode: 'native', width: 320 } });
    expect(results.map((r) => r.size)).toEqual(['16x9', '4x3']);

    for (const result of results) {
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(isZip(result.buffer)).toBe(true);
      const zip = await JSZip.loadAsync(result.buffer);
      expect(zip.file('ppt/presentation.xml')).not.toBeNull();
      expect(zip.file(`ppt/slides/slide${SLIDE_COUNT}.xml`)).not.toBeNull();
      expect(zip.file(`ppt/slides/slide${SLIDE_COUNT + 1}.xml`)).toBeNull();

      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.preview!.slides).toHaveLength(SLIDE_COUNT);
      for (const png of result.preview!.slides) {
        expect(isPng(png)).toBe(true);
        expect(pngSize(png).width).toBe(320);
      }
      expect(isPng(result.preview!.overview)).toBe(true);
    }

    const [wide, standard] = results;
    const ratio = (png: Buffer) => pngSize(png).height / pngSize(png).width;
    expect(ratio(wide!.preview!.slides[0]!)).toBeCloseTo(405 / 720, 2);
    expect(ratio(standard!.preview!.slides[0]!)).toBeCloseTo(540 / 720, 2);
  }, 60_000);

  it('preview false omits the preview', async () => {
    const results = await render(deck, { sizes: ['16x9', '4x3'], preview: false });
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.preview).toBeUndefined();
      expect(isZip(result.buffer)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
    }
  }, 60_000);

  it('emits the text content and the size-specific text in each pptx', async () => {
    const results = await render(deck, { sizes: ['16x9', '4x3'], preview: false });
    for (const result of results) {
      const zip = await JSZip.loadAsync(result.buffer);
      const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
      expect(xml).toContain('Título com acentuação');
      expect(xml).toContain(`Tamanho ${result.size}`);
    }
  }, 60_000);
});

const slide1Xml = async (result: RenderResult): Promise<string> =>
  (await JSZip.loadAsync(result.buffer)).file('ppt/slides/slide1.xml')!.async('string');

const BR = /<a:br\b[^>]*\/>/g;
const paragraphsOf = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [];
const textOf = (fragment: string): string => [...fragment.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1] ?? '').join('');

describe('render — includePositioned (M7)', () => {
  it('returns the positioned tree per size, frames in pt', async () => {
    const results = await render(deck, { sizes: ['16x9', '4x3'], preview: false, includePositioned: true });
    const expected = { '16x9': { width: 720, height: 405 }, '4x3': { width: 720, height: 540 } } as const;
    for (const result of results) {
      const positioned = result.positioned;
      expect(positioned).toBeDefined();
      expect(positioned!.slides).toHaveLength(SLIDE_COUNT);
      const { width, height } = expected[result.size as keyof typeof expected];
      expect(positioned!.size).toMatchObject({ name: result.size, width, height });
      for (const slide of positioned!.slides) expectFrame(slide.frame, { x: 0, y: 0, width, height });
      // Primeiro Text do slide 1 começa no padding (36 pt) e ocupa a largura útil.
      const title = positioned!.slides[0]!.children[0]!;
      expect(title.kind).toBe('text');
      expectFrame({ ...title.frame, height: 0 }, { x: 36, y: 36, width: width - 72, height: 0 });
    }
  }, 60_000);

  it('positioned is the post-fit tree that went to the emitter (its lines are in the XML)', async () => {
    const [result] = await render(deck, { preview: false, includePositioned: true });
    const title = result!.positioned!.slides[0]!.children[0]!;
    if (title.kind !== 'text') throw new Error('expected text');
    const xml = await slide1Xml(result!);
    for (const line of title.text.lines) expect(xml).toContain(line);
  }, 60_000);

  it('without the option, positioned is undefined', async () => {
    for (const options of [{ preview: false as const }, { preview: false as const, includePositioned: false }]) {
      const results = await render(deck, { ...options, sizes: ['16x9', '4x3'] });
      for (const result of results) expect(result.positioned).toBeUndefined();
    }
  }, 60_000);
});

const URL_CONTENT = 'Veja exemplo.com/a/b agora';

const urlDeck = defineDeck(() => (
  <Deck>
    <Slide padding={36}>
      <Box width={110}>
        <Text size={18}>{URL_CONTENT}</Text>
      </Box>
    </Slide>
  </Deck>
));

const firstText = (nodes: readonly PositionedNode[]): PositionedNode | undefined =>
  nodes.reduce<PositionedNode | undefined>(
    (found, node) => found ?? (node.kind === 'text' ? node : node.kind === 'box' ? firstText(node.children) : undefined),
    undefined,
  );

const renderUrl = async (lineBreaks?: LineBreaks) => {
  const options = { preview: false as const, includePositioned: true, ...(lineBreaks ? { lineBreaks } : {}) };
  const [result] = await render(urlDeck, options);
  const text = firstText(result!.positioned!.slides[0]!.children);
  if (text?.kind !== 'text') throw new Error('expected a text node');
  return { lines: text.text.lines, xml: await slide1Xml(result!) };
};

describe('render — lineBreaks reaches the emitter (M7)', () => {
  it('narrow box: the URL breaks after a slash (precondition of the cases below)', async () => {
    const { lines } = await renderUrl();
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.slice(0, -1).some((line) => line.endsWith('/'))).toBe(true);
  }, 60_000);

  it("'auto': no <a:br/>, one <a:p> whose text is the original content (no space after '/')", async () => {
    const { xml } = await renderUrl('auto');
    expect(xml.match(BR)).toBeNull();
    const ps = paragraphsOf(xml).filter((p) => textOf(p).length > 0);
    expect(ps.map(textOf)).toEqual([URL_CONTENT]);
  }, 60_000);

  it.each([['forced' as const], [undefined]])('%s: one <a:br/> per extra line', async (lineBreaks) => {
    const { lines, xml } = await renderUrl(lineBreaks);
    expect(xml.match(BR)).toHaveLength(lines.length - 1);
    const ps = paragraphsOf(xml).filter((p) => textOf(p).length > 0);
    expect(ps.map(textOf)).toEqual([lines.join('')]);
  }, 60_000);
});
