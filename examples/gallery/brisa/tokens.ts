import { defineTokens, themeOf } from '@pptsx/ds-kit';

// Brisa · DS de app de finanças pessoais: fundo de papel quente, pastéis de fundo (menta, pêssego,
// lilás, manteiga) e a versão profunda de cada um para texto e dados. Raios grandes, sombras macias.
export const tokens = defineTokens({
  color: {
    bg: '#FBF7F2',
    ink: '#2B2340',
    soft: '#7A7290',
    card: '#FFFFFF',
    track: '#F0EAE2',
    mint: '#C9EEDD',
    mintDeep: '#1E8F67',
    peach: '#FFDCCB',
    peachDeep: '#E06A3B',
    lilac: '#E2DAFF',
    lilacDeep: '#6B55D9',
    butter: '#FFF0B8',
    butterDeep: '#B98A00',
  },
  font: { hero: 42, h1: 28, h2: 16, body: 12, small: 10 },
  space: { page: 44, gap: 14, radius: 22 },
});

export const theme = themeOf(tokens, {
  name: 'Brisa',
  colors: { dark1: 'color.ink', light1: 'color.card', dark2: 'color.soft', light2: 'color.bg', accent1: 'color.lilacDeep', accent2: 'color.mintDeep', accent3: 'color.peachDeep', accent4: 'color.butterDeep' },
  fonts: { heading: 'Inter', body: 'Inter' },
});
