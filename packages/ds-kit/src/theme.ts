import { resolveTheme, toHexColor, type Theme, type ThemeColorName } from 'pptsx';
import type { TokenSource } from './tokens.ts';

/**
 * Tokens → `Theme` do núcleo (o contrato do arquivo PPTX). O mapa diz qual token vai em cada slot
 * (`accent1: 'color.accent'`) ou dá a cor direto. `checkTheme` avisa contraste abaixo do WCAG AA.
 */

export interface ThemeMap {
  readonly name?: string;
  readonly colors: Partial<Record<ThemeColorName, string>>;
  readonly fonts?: { readonly heading?: string; readonly body?: string };
}

const lookup = (tokens: TokenSource, ref: string): string => {
  const value = ref.split('.').reduce<unknown>((node, key) => (typeof node === 'object' && node !== null ? (node as Readonly<Record<string, unknown>>)[key] : undefined), tokens);
  // Sem token nesse caminho, o próprio texto tem que ser uma cor.
  return toHexColor(typeof value === 'string' ? value : ref);
};

export const themeOf = (tokens: TokenSource, map: ThemeMap): Theme => {
  const colors = Object.fromEntries(Object.entries(map.colors).map(([slot, ref]) => [slot, lookup(tokens, ref!)]));
  const theme: Theme = { ...(map.name === undefined ? {} : { name: map.name }), colors, ...(map.fonts === undefined ? {} : { fonts: map.fonts }) };
  resolveTheme(theme);
  return theme;
};

// WCAG 2.x: luminância relativa e razão de contraste.
const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

export const contrastOf = (a: string, b: string): number => {
  const [light, dark] = [luminance(toHexColor(a)), luminance(toHexColor(b))].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

/** WCAG AA: 4,5 para texto normal; 3 para texto grande (títulos, números de KPI). */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

/** Avisos de contraste: texto (dark1/dark2) sobre o fundo (light1/light2) e acentos sobre light1. */
export const checkTheme = (theme: Theme): readonly string[] => {
  const resolved = resolveTheme(theme);
  const c = resolved.colors;
  const pairs: readonly (readonly [ThemeColorName, ThemeColorName, number])[] = [
    ['dark1', 'light1', AA_TEXT], ['dark1', 'light2', AA_TEXT], ['dark2', 'light1', AA_TEXT],
    ['accent1', 'light1', AA_LARGE], ['accent2', 'light1', AA_LARGE], ['accent3', 'light1', AA_LARGE],
  ];
  return pairs
    .filter(([a, b]) => resolved.declared.includes(a) && resolved.declared.includes(b))
    .flatMap(([a, b, minimum]) => {
      const ratio = contrastOf(c[a], c[b]);
      return ratio >= minimum ? [] : [`contraste ${a} (${c[a]}) sobre ${b} (${c[b]}) é ${ratio.toFixed(2)}:1, abaixo do WCAG AA (${minimum}:1)`];
    });
};
