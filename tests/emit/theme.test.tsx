import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { applyThemeColors, applyThemeFonts, colorSchemeXmlOf, schemeMapOf, themeFontMapOf } from '../../src/emit/theme.ts';
import { Box, Chart, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import { resolveTheme } from '../../src/resolve/index.ts';
import type { RenderOptions, SlideElement } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

const THEME = { name: 'Marca', colors: { accent1: '#2F6FED', dark1: '#1B2A4A', light2: 'rgb(244, 246, 250)' }, fonts: { heading: 'Georgia', body: 'Arial' } };

describe('M15-2 — resolveTheme', () => {
  it('normaliza as cores, completa com o Office e guarda as declaradas', () => {
    const theme = resolveTheme(THEME);
    expect(theme.colors.light2).toBe('#F4F6FA');
    expect(theme.colors.accent2).toBe('#ED7D31');
    expect(theme.declared).toEqual(['accent1', 'dark1', 'light2']);
    expect(resolveTheme({}).name).toBe('pptsx');
  });

  it('cor inválida, cor desconhecida ou fonte vazia → Error com a chave', () => {
    expect(() => resolveTheme({ colors: { accent1: 'azulzinho' } })).toThrow(/theme\.colors\.accent1/);
    expect(() => resolveTheme({ colors: { accent7: '#000000' } as never })).toThrow(/theme\.colors\.accent7 não existe/);
    expect(() => resolveTheme({ fonts: { body: ' ' } })).toThrow(/theme\.fonts\.body/);
  });
});

describe('M15-2 — XML do tema', () => {
  const theme = resolveTheme(THEME);

  it('clrScheme com as 12 cores na ordem do schema', () => {
    const xml = colorSchemeXmlOf(theme);
    expect(xml.match(/<a:(\w+)><a:srgbClr/g)!.map((tag) => tag.slice(3, -11))).toEqual(['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']);
    expect(xml).toContain('<a:accent1><a:srgbClr val="2F6FED"/></a:accent1>');
    expect(xml).toContain('<a:dk1><a:srgbClr val="1B2A4A"/></a:dk1>');
  });

  it('só as cores declaradas viram schemeClr (dk1 → tx1, lt2 → bg2), com os filhos preservados', () => {
    const map = schemeMapOf(theme);
    expect([...map.entries()]).toEqual([['2F6FED', 'accent1'], ['1B2A4A', 'tx1'], ['F4F6FA', 'bg2']]);
    const xml = '<a:srgbClr val="2f6fed"/><a:srgbClr val="1B2A4A"><a:alpha val="50000"/></a:srgbClr><a:srgbClr val="ED7D31"/>';
    expect(applyThemeColors(xml, map)).toBe('<a:schemeClr val="accent1"/><a:schemeClr val="tx1"><a:alpha val="50000"/></a:schemeClr><a:srgbClr val="ED7D31"/>');
  });

  it('empate de hex: o acento vence', () => {
    const tie = resolveTheme({ colors: { dark1: '#112233', accent3: '#112233' } });
    expect(schemeMapOf(tie).get('112233')).toBe('accent3');
  });

  it('famílias do tema viram +mj-lt / +mn-lt; com título = corpo, +mn-lt', () => {
    const fonts = themeFontMapOf(theme);
    expect(applyThemeFonts('<a:latin typeface="Georgia" pitchFamily="34"/><a:latin typeface="Arial"/><a:latin typeface="Inter"/>', fonts))
      .toBe('<a:latin typeface="+mj-lt" pitchFamily="34"/><a:latin typeface="+mn-lt"/><a:latin typeface="Inter"/>');
    expect(themeFontMapOf(resolveTheme({ fonts: { heading: 'Inter', body: 'Inter' } })).get('Inter')).toBe('+mn-lt');
  });
});

describe('M15-2 — de ponta a ponta', () => {
  const deck = (
    <Deck>
      <Slide padding={30} gap={10} backgroundColor="#FFFFFF">
        <Text fontSize={28} color="#2F6FED">Título</Text>
        <Box height={40} backgroundColor="#2F6FED" border="2px solid #D64545" />
        <Text color="#1B2A4A">Corpo</Text>
        <Chart kind="bar" flex={1} colors={['#2F6FED']} data={{ categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] }} />
      </Slide>
    </Deck>
  ) as SlideElement;

  const partsOf = async (options: RenderOptions) => {
    const [result] = await render(() => deck, { preview: false, ...options });
    const zip = await JSZip.loadAsync(result!.buffer);
    const read = (name: string) => zip.file(name)!.async('string');
    return { slide: await read('ppt/slides/slide1.xml'), theme: await read('ppt/theme/theme1.xml'), chart: await read('ppt/charts/chart1.xml') };
  };

  it('theme1.xml com a paleta e as fontes; slide e gráfico com schemeClr; fora do tema continua hex', async () => {
    const { slide, theme, chart } = await partsOf({ theme: THEME });
    expect(theme).toContain('<a:clrScheme name="Marca">');
    expect(theme).toMatch(/<a:majorFont><a:latin typeface="Georgia"\/>/);
    expect(theme).toMatch(/<a:minorFont><a:latin typeface="Arial"\/>/);
    expect(slide).toContain('<a:schemeClr val="accent1"/>');
    expect(slide).toContain('<a:schemeClr val="tx1"/>');
    expect(slide).toContain('<a:srgbClr val="D64545"/>');
    expect(slide).toContain('typeface="+mn-lt"');
    expect(slide).not.toContain('val="2F6FED"');
    expect(chart).toContain('<a:schemeClr val="accent1"/>');
  });

  it('sem theme, as partes saem iguais às de antes do M15', async () => {
    const before = await partsOf({});
    const again = await partsOf({});
    expect(before.slide).toBe(again.slide);
    expect(before.slide).not.toContain('schemeClr');
    expect(before.theme).toContain('<a:clrScheme name="Office">');
  });

  it('o preview não muda com o tema', async () => {
    const plain = await build(deck);
    const themed = await build(deck, { theme: THEME });
    expect(themed.svg).toEqual(plain.svg);
  });
});
