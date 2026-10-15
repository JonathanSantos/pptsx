import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { createFontRegistry, weightPreference } from '../../src/text/registry.ts';
import { createFontkitMeasurer } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { parseFontWeight } from '../../src/resolve/values.ts';
import { render } from '../../src/render.ts';
import { slideToSvg } from '../../src/preview/index.ts';
import { Deck, Slide, Span, Text } from '../../src/primitives/index.ts';
import type { FontFace, RenderOptions, SlideElement } from '../../src/core/types.ts';

const inter = (file: string) => fileURLToPath(new URL(`../fixtures/fonts/inter/${file}`, import.meta.url));
const INTER: readonly FontFace[] = [
  { family: 'Inter', weight: 'regular', file: inter('Inter-Regular.ttf') },
  { family: 'Inter', weight: 300, file: inter('Inter-Light.ttf') },
  { family: 'Inter', weight: 600, file: inter('Inter-SemiBold.ttf') },
  { family: 'Inter', weight: 'bold', file: inter('Inter-Bold.ttf') },
];
const FONTS: readonly FontFace[] = [...DEFAULT_FONTS, ...INTER];

describe('M13-2 — fontWeight no resolve', () => {
  it.each([
    ['bold', 'bold'],
    ['normal', 'regular'],
    [400, 'regular'],
    [700, 'bold'],
    ['700', 'bold'],
    [600, 600],
    [350, 350],
  ] as const)('%s → %s', (input, expected) => {
    expect(parseFontWeight(input)).toBe(expected);
  });

  it.each([0, 1001, 'bolder', 'x'])('%s é inválido', (input) => {
    expect(parseFontWeight(input)).toBeUndefined();
  });
});

describe('M13-2 — correspondência de peso (CSS Fonts §5.2)', () => {
  const available = [300, 400, 600, 700];
  it.each([
    [400, [400, 300, 600, 700]],
    [500, [400, 300, 600, 700]],
    [300, [300, 400, 600, 700]],
    [200, [300, 400, 600, 700]],
    [600, [600, 700, 400, 300]],
    [800, [700, 600, 400, 300]],
  ])('pedido %i → ordem %j', (wanted, order) => {
    expect(weightPreference(available, wanted)).toEqual(order);
  });

  it('500 com uma face 500 vence a 400; 450 tenta 500 antes de descer', () => {
    expect(weightPreference([400, 500], 500)[0]).toBe(500);
    expect(weightPreference([400, 500], 450)[0]).toBe(500);
  });

  it('registro com 4 faces da Inter: 300/500/600/800', () => {
    const registry = createFontRegistry(INTER);
    expect(registry.match('Inter', 300, false)?.weight).toBe(300);
    expect(registry.match('Inter', 500, false)?.weight).toBe(400);
    expect(registry.match('Inter', 600, false)?.weight).toBe(600);
    expect(registry.match('Inter', 800, false)?.weight).toBe(700);
    expect(registry.match('Inter', 'regular', true)?.weight).toBe(400);
  });
});

describe('M13-2 — RunFace do medidor', () => {
  const measure = createFontkitMeasurer(createFontRegistry(INTER), { safety: 1 });
  const style = { family: 'Inter', size: 20, weight: 'regular' as const, italic: false, lineHeight: 'normal' as const };
  const runs = (weights: readonly (number | 'regular' | 'bold')[]) =>
    weights.map((weight, index) => ({ text: `t${index} `, weight, italic: false, color: '#000000' }));

  it('400/700: família do autor e flag; outros: nome da face e sem negrito', () => {
    const r = measure({ content: 't0 t1 t2 t3 ', style, runs: runs(['regular', 'bold', 600, 300]), maxWidth: Infinity });
    expect(r.faces).toEqual([
      { typeface: 'Inter', bold: false, weight: 400, previewFamily: 'Inter' },
      { typeface: 'Inter', bold: true, weight: 700, previewFamily: 'Inter' },
      { typeface: 'Inter SemiBold', bold: false, weight: 600, previewFamily: 'Inter' },
      { typeface: 'Inter Light', bold: false, weight: 300, previewFamily: 'Inter' },
    ]);
  });

  it('semibold mede mais largo que regular (face real)', () => {
    const regular = measure({ content: 'Relatório', style, maxWidth: Infinity }).width;
    const semibold = measure({ content: 'Relatório', style, runs: [{ text: 'Relatório', weight: 600, italic: false, color: '#000000' }], maxWidth: Infinity }).width;
    expect(semibold).toBeGreaterThan(regular);
  });

  it('pedido longe da face usada registra requested (100 → 300)', () => {
    const r = measure({ content: 'x', style, runs: [{ text: 'x', weight: 100, italic: false, color: '#000000' }], maxWidth: Infinity });
    expect(r.faces?.[0]).toMatchObject({ weight: 300, requested: 100 });
  });
});

const build = async (deck: SlideElement, options: RenderOptions = {}) => {
  const [result] = await render(() => deck, { fonts: FONTS, preview: false, includePositioned: true, ...options });
  const xml = await (await JSZip.loadAsync(result!.buffer)).file('ppt/slides/slide1.xml')!.async('string');
  return { result: result!, xml };
};

describe('M13-2 — de ponta a ponta', () => {
  it('Span semibold sai com typeface da face, sem negrito; o bold com a família e b="1"', async () => {
    const { xml, result } = await build(
      <Deck>
        <Slide>
          <Text fontFamily="Inter">a <Span fontWeight={600}>semi</Span> <Span fontWeight="bold">bold</Span></Text>
        </Slide>
      </Deck>,
    );
    expect(result.diagnostics).toEqual([]);
    const semiRun = /<a:rPr([^>]*)>(?:(?!<\/a:rPr>).)*<a:latin typeface="Inter SemiBold"/s.exec(xml);
    expect(semiRun).not.toBeNull();
    // Sem negrito: o pptxgenjs omite b quando é falso.
    expect(semiRun![1]).not.toContain('b="1"');
    expect(xml).toMatch(/<a:rPr[^>]*b="1"/);
    const svg = slideToSvg(result.positioned!.slides[0]!, result.positioned!.size, { widthPx: 720, baseDir: process.cwd() });
    expect(svg).toContain('font-weight="600"');
  });

  it('peso sem face próxima → font-weight-fallback (warning) uma vez por Text', async () => {
    const { result } = await build(
      <Deck>
        <Slide>
          <Text fontWeight={900}>a <Span fontWeight={900}>b</Span></Text>
          <Text fontFamily="Inter" fontWeight={500}>sem aviso</Text>
        </Slide>
      </Deck>,
    );
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'font-weight-fallback', severity: 'warning', path: 'Slide > Text[0]', data: { requestedWeight: 900, usedWeight: 700 } }),
    ]);
  });

  it('embed: face fora de 400/700 vai com o nome da própria face', async () => {
    const { result } = await build(
      <Deck>
        <Slide>
          <Text fontFamily="Inter" fontWeight={600}>semi</Text>
        </Slide>
      </Deck>,
      { embedFonts: true },
    );
    const presentation = await (await JSZip.loadAsync(result.buffer)).file('ppt/presentation.xml')!.async('string');
    expect(presentation).toContain('typeface="Inter SemiBold"');
  });
});
