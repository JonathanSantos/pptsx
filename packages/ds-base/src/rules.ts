import { colorsFromTokens, fontsFromTheme, maxChildren, onlyOnSlide } from '@pptsx/ds-kit';
import { theme } from './theme.ts';
import { tokens } from './tokens.ts';

/** Regras de marca do ds-base (entram no `pptsx lint` quando o DS está registrado na config). */
export const rules = [
  colorsFromTokens('ds-base/colors-from-tokens', tokens),
  fontsFromTheme('ds-base/fonts-from-theme', theme),
  maxChildren('ds-base/kpi-row-max-4', 'KpiRow', 4),
  onlyOnSlide('ds-base/cover-only-first', 'CoverLayout', 1),
] as const;
