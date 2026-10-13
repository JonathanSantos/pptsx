import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { render } from '../src/render.ts';
import { defineDeck } from '../src/index.ts';
import { Box, Deck, Slide, Text } from '../src/primitives/index.ts';
import type { DeckContext } from '../src/core/types.ts';
import { isPng, pngSize } from './helpers/png.ts';

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
