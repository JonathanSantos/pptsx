import { DEFAULTS } from '../core/defaults.ts';
import type { ResolvedTheme, Theme, ThemeColorName, ThemeFonts } from '../core/types.ts';
import { hexOf } from './colors.ts';

/**
 * M15: tema do arquivo normalizado uma vez por render (cores em '#RRGGBB'). Erro de digitação no tema
 * é erro de configuração: lança Error com o caminho da chave, antes de medir qualquer slide.
 */

const COLOR_NAMES = Object.keys(DEFAULTS.theme.colors) as readonly ThemeColorName[];

const isColorName = (key: string): key is ThemeColorName => (COLOR_NAMES as readonly string[]).includes(key);

const colorOf = (name: ThemeColorName, value: unknown): string => {
  try {
    return hexOf(`theme.colors.${name}`, value);
  } catch (error) {
    throw new Error(`theme.colors.${name}: ${(error as Error).message}`, { cause: error });
  }
};

const fontsOf = (fonts: ThemeFonts | undefined): ThemeFonts => {
  if (fonts === undefined) return {};
  (['heading', 'body'] as const).forEach((key) => {
    const value = fonts[key];
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) throw new Error(`theme.fonts.${key}: use o nome de uma família ("Inter")`);
  });
  return { ...(fonts.heading === undefined ? {} : { heading: fonts.heading }), ...(fonts.body === undefined ? {} : { body: fonts.body }) };
};

export const resolveTheme = (theme: Theme): ResolvedTheme => {
  const given = Object.entries(theme.colors ?? {}).filter(([, value]) => value !== undefined);
  const unknown = given.find(([key]) => !isColorName(key));
  if (unknown !== undefined) throw new Error(`theme.colors.${unknown[0]} não existe; use ${COLOR_NAMES.join(', ')}`);
  const declared = given.map(([key]) => key as ThemeColorName);
  const colors = Object.fromEntries(
    COLOR_NAMES.map((name) => {
      const value = (theme.colors as Readonly<Record<string, unknown>> | undefined)?.[name];
      return [name, value === undefined ? DEFAULTS.theme.colors[name] : colorOf(name, value)];
    }),
  ) as Record<ThemeColorName, string>;
  const name = theme.name === undefined || theme.name.trim() === '' ? DEFAULTS.theme.name : theme.name;
  return { name, colors, declared, fonts: fontsOf(theme.fonts) };
};
