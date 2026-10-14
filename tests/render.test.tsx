import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { render } from '../src/render.ts';
import { defineDeck } from '../src/index.ts';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { B, Box, Deck, Slide, Text } from '../src/primitives/index.ts';
import { DEFAULT_FONTS } from '../src/fonts/index.ts';
import type { DeckContext, FontFace, LineBreaks, PositionedNode, RenderResult } from '../src/core/types.ts';
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

// ───────────── M8: fontes do sistema, embed e rich text ─────────────

/** Família que nenhuma máquina tem instalada (o teste não pode depender do sistema). */
const NO_SUCH_FAMILY = 'Pptsx Fonte Inexistente';
const LIBERATION = 'Liberation Sans';
const liberationFile = (name: string): string =>
  fileURLToPath(new URL(`../fonts/LiberationSans-${name}.ttf`, import.meta.url));
const LIBERATION_FACES: readonly FontFace[] = [
  { family: LIBERATION, weight: 'regular', file: liberationFile('Regular') },
  { family: LIBERATION, weight: 'bold', file: liberationFile('Bold') },
];

const fontDeck = (family: string, weight: 'regular' | 'bold' = 'regular') =>
  defineDeck(() => (
    <Deck>
      <Slide padding={36}>
        <Text>Arial padrão</Text>
        <Text font={family} weight={weight}>
          Texto na outra fonte
        </Text>
      </Slide>
    </Deck>
  ));

const fntdataOf = async (result: RenderResult): Promise<string[]> =>
  Object.keys((await JSZip.loadAsync(result.buffer)).files).filter((name) => name.endsWith('.fntdata'));

describe('render — fonts without file (M8)', () => {
  it('a face not found on the system → fontsMissing and font-missing on the Texts that use it', async () => {
    const [result] = await render(fontDeck(NO_SUCH_FAMILY, 'bold'), {
      preview: false,
      fonts: [...DEFAULT_FONTS, { family: NO_SUCH_FAMILY, weight: 'bold' }],
    });
    expect(result!.fontsMissing).toEqual([`${NO_SUCH_FAMILY} bold`]);
    const missing = result!.diagnostics.filter((d) => d.code === 'font-missing');
    expect(missing.map((d) => d.path)).toEqual(['Slide > Text[1]']);
  }, 60_000);

  it('without missing faces, fontsMissing is absent', async () => {
    const [byDefault] = await render(fontDeck('Arial'), { preview: false });
    expect(byDefault!.fontsMissing).toBeUndefined();
    const [explicit] = await render(fontDeck(LIBERATION), { preview: false, fonts: [...DEFAULT_FONTS, ...LIBERATION_FACES] });
    expect(explicit!.fontsMissing).toBeUndefined();
  }, 60_000);

  it('the preview still renders with a missing face', async () => {
    const [result] = await render(fontDeck(NO_SUCH_FAMILY, 'bold'), {
      preview: { mode: 'native', width: 320 },
      fonts: [...DEFAULT_FONTS, { family: NO_SUCH_FAMILY, weight: 'bold' }],
    });
    expect(isPng(result!.preview!.slides[0]!)).toBe(true);
  }, 60_000);
});

describe('render — embedFonts (M8)', () => {
  it('DEFAULT_FONTS (Arial) is never embedded', async () => {
    const [result] = await render(fontDeck('Arial', 'bold'), { preview: false, embedFonts: true });
    expect(await fntdataOf(result!)).toEqual([]);
  }, 60_000);

  it('a registered face with file that the deck uses is embedded', async () => {
    const [result] = await render(fontDeck(LIBERATION), {
      preview: false,
      embedFonts: true,
      fonts: [...DEFAULT_FONTS, ...LIBERATION_FACES],
    });
    expect(await fntdataOf(result!)).toHaveLength(1);
    const xml = await (await JSZip.loadAsync(result!.buffer)).file('ppt/presentation.xml')!.async('string');
    expect(xml).toMatch(new RegExp(`<p:embeddedFont>[\\s\\S]*typeface="${LIBERATION}"`));
  }, 60_000);

  it('a registered face the deck does not use is not embedded', async () => {
    const [result] = await render(fontDeck('Arial'), {
      preview: false,
      embedFonts: true,
      fonts: [...DEFAULT_FONTS, ...LIBERATION_FACES],
    });
    expect(await fntdataOf(result!)).toEqual([]);
  }, 60_000);

  it('embedFonts false (default) never embeds', async () => {
    const [result] = await render(fontDeck(LIBERATION), { preview: false, fonts: [...DEFAULT_FONTS, ...LIBERATION_FACES] });
    expect(await fntdataOf(result!)).toEqual([]);
  }, 60_000);

  it('a restricted face (fsType 0x0002) is not embedded and gives font-not-embeddable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pptsx-restricted-'));
    try {
      const file = join(dir, 'restrita.ttf');
      copyFileSync(liberationFile('Regular'), file);
      const ttf = readFileSync(file);
      const tables = ttf.readUInt16BE(4);
      const os2 = Array.from({ length: tables }, (_, i) => 12 + i * 16).find(
        (record) => ttf.toString('latin1', record, record + 4) === 'OS/2',
      );
      if (os2 === undefined) throw new Error('no OS/2');
      ttf.writeUInt16BE(0x0002, ttf.readUInt32BE(os2 + 8) + 8);
      writeFileSync(file, ttf);
      const [result] = await render(fontDeck('Restrita'), {
        preview: false,
        embedFonts: true,
        fonts: [...DEFAULT_FONTS, { family: 'Restrita', weight: 'regular', file }],
      });
      expect(await fntdataOf(result!)).toEqual([]);
      const warnings = result!.diagnostics.filter((d) => d.code === 'font-not-embeddable');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({ severity: 'warning', slide: 0, path: '' });
      expect(warnings[0]!.message).toContain('Restrita');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('render — rich text end to end (M8)', () => {
  const richDeck = defineDeck(() => (
    <Deck>
      <Slide padding={36}>
        <Text size={20}>
          Receita <B>subiu</B> 14%
        </Text>
      </Slide>
    </Deck>
  ));

  it('the bold Span becomes its own <a:r> with b="1"', async () => {
    const [result] = await render(richDeck, { preview: { mode: 'native', width: 320 } });
    const xml = await slide1Xml(result!);
    const runs = [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map((m) => m[1] ?? '');
    const texts = runs.map((r) => /<a:t>([\s\S]*?)<\/a:t>/.exec(r)?.[1] ?? '');
    expect(texts.join('')).toBe('Receita subiu 14%');
    expect(runs.filter((r) => /\bb="1"/.test(r)).map((r) => /<a:t>([\s\S]*?)<\/a:t>/.exec(r)?.[1])).toEqual(['subiu']);
    expect(isPng(result!.preview!.slides[0]!)).toBe(true);
  }, 60_000);
});
