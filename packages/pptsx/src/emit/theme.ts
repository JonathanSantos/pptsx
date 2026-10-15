import JSZip from 'jszip';
import { DEFAULTS } from '../core/defaults.ts';
import type { ResolvedTheme, ThemeColorName } from '../core/types.ts';

/**
 * Tema do arquivo (M15-2), como pós-processamento do zip: o pptxgenjs não expõe o esquema de cores.
 * `theme1.xml` recebe as 12 cores e as fontes do tema; nos slides, layouts, masters e gráficos, cada
 * `<a:srgbClr>` com o hex de uma cor **declarada** pelo autor vira `<a:schemeClr>` e cada família do
 * tema vira `+mj-lt`/`+mn-lt`. Trocar a cor no PowerPoint repinta o deck; o layout não muda.
 */

/** Ordem do CT_ColorScheme e nome do elemento de cada cor no `theme1.xml`. */
const SCHEME_ELEMENTS: readonly (readonly [ThemeColorName, string])[] = [
  ['dark1', 'dk1'], ['light1', 'lt1'], ['dark2', 'dk2'], ['light2', 'lt2'],
  ['accent1', 'accent1'], ['accent2', 'accent2'], ['accent3', 'accent3'], ['accent4', 'accent4'], ['accent5', 'accent5'], ['accent6', 'accent6'],
  ['hyperlink', 'hlink'], ['followedHyperlink', 'folHlink'],
];

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const bareHex = (color: string): string => color.replace(/^#/, '').toUpperCase();

export const colorSchemeXmlOf = (theme: ResolvedTheme): string =>
  `<a:clrScheme name="${escapeXml(theme.name)}">` +
  SCHEME_ELEMENTS.map(([name, element]) => `<a:${element}><a:srgbClr val="${bareHex(theme.colors[name])}"/></a:${element}>`).join('') +
  '</a:clrScheme>';

const CLR_SCHEME = /<a:clrScheme\b[^>]*>[\s\S]*?<\/a:clrScheme>/;
const THEME_NAME = /(<a:theme\b[^>]*?\sname=")[^"]*(")/;

const withFont = (xml: string, slot: 'majorFont' | 'minorFont', family: string | undefined): string => {
  if (family === undefined) return xml;
  const latin = new RegExp(`(<a:${slot}>\\s*)<a:latin\\b[^>]*/>`);
  return xml.replace(latin, `$1<a:latin typeface="${escapeXml(family)}"/>`);
};

/** `theme1.xml` com o nome, as 12 cores e as fontes de título (major) e corpo (minor) do tema. */
export const themeXmlOf = (xml: string, theme: ResolvedTheme): string => {
  const named = xml.replace(THEME_NAME, `$1${escapeXml(theme.name)}$2`).replace(CLR_SCHEME, colorSchemeXmlOf(theme));
  return withFont(withFont(named, 'majorFont', theme.fonts.heading), 'minorFont', theme.fonts.body);
};

/** Hex (sem '#', maiúsculo) → valor do `<a:schemeClr>`; empate de hex: a 1ª cor na ordem de DEFAULTS.theme.schemes. */
export const schemeMapOf = (theme: ResolvedTheme): ReadonlyMap<string, string> =>
  DEFAULTS.theme.schemes.reduce((map, [name, scheme]) => {
    const color = name as ThemeColorName;
    if (!theme.declared.includes(color)) return map;
    const hex = bareHex(theme.colors[color]);
    return map.has(hex) ? map : new Map(map).set(hex, scheme);
  }, new Map<string, string>());

// `<a:srgbClr val="…"/>` ou com filhos (alpha, lumMod): os filhos seguem no schemeClr. Não há srgbClr aninhado.
const SRGB = /<a:srgbClr val="([0-9A-Fa-f]{6})"\s*(?:\/>|>([\s\S]*?)<\/a:srgbClr>)/g;

export const applyThemeColors = (xml: string, schemes: ReadonlyMap<string, string>): string =>
  schemes.size === 0
    ? xml
    : xml.replace(SRGB, (whole, hex: string, children: string | undefined) => {
        const scheme = schemes.get(hex.toUpperCase());
        if (scheme === undefined) return whole;
        return children === undefined || children === '' ? `<a:schemeClr val="${scheme}"/>` : `<a:schemeClr val="${scheme}">${children}</a:schemeClr>`;
      });

/** Família → fonte do tema; com título e corpo iguais, vale a de corpo (+mn-lt). */
export const themeFontMapOf = (theme: ResolvedTheme): ReadonlyMap<string, string> => {
  const entries: (readonly [string, string])[] = [];
  if (theme.fonts.heading !== undefined) entries.push([escapeXml(theme.fonts.heading), '+mj-lt']);
  if (theme.fonts.body !== undefined) entries.push([escapeXml(theme.fonts.body), '+mn-lt']);
  return new Map(entries);
};

const LATIN = /<a:latin typeface="([^"]*)"/g;

export const applyThemeFonts = (xml: string, fonts: ReadonlyMap<string, string>): string =>
  fonts.size === 0 ? xml : xml.replace(LATIN, (whole, family: string) => {
    const theme = fonts.get(family);
    return theme === undefined ? whole : `<a:latin typeface="${theme}"`;
  });

const THEME_PART = /^ppt\/theme\/theme\d+\.xml$/;
const DRAWING_PART = /^ppt\/(slides\/slide|slideLayouts\/slideLayout|slideMasters\/slideMaster|charts\/chart)\d+\.xml$/;

/** Aplica o tema ao pacote. Sem tema: o buffer volta intacto. */
export const applyTheme = async (buffer: Buffer, theme: ResolvedTheme | undefined): Promise<Buffer> => {
  if (theme === undefined) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  const schemes = schemeMapOf(theme);
  const fonts = themeFontMapOf(theme);
  await Promise.all(
    Object.keys(zip.files).map(async (name) => {
      const file = zip.file(name);
      if (file === null) return;
      if (THEME_PART.test(name)) zip.file(name, themeXmlOf(await file.async('string'), theme));
      else if (DRAWING_PART.test(name)) zip.file(name, applyThemeFonts(applyThemeColors(await file.async('string'), schemes), fonts));
    }),
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
