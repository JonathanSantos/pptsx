import { themeOf } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

/**
 * Tema do arquivo do ds-base (M15): cada cor usada nos slides que bate com uma daqui sai como cor do
 * tema no PowerPoint/Keynote; trocar a cor no seletor do tema repinta o deck. `ink` e `brand` têm o
 * mesmo hex: fica só `dark1` (texto), para o texto não virar "acento".
 */
export const theme = themeOf(tokens, {
  name: 'Exemplos pptsx',
  colors: {
    dark1: 'color.ink',
    light1: 'color.white',
    dark2: 'color.muted',
    light2: 'color.surface',
    accent1: 'color.accent',
    accent2: 'color.positive',
    accent3: 'color.negative',
    accent4: 'color.accentSoft',
    accent5: 'color.brandDark',
  },
  fonts: { heading: 'Arial', body: 'Arial' },
});
