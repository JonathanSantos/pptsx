import { defineTokens, themeOf } from '@pptsx/ds-kit';

// Nebula · DS escuro de produto de tecnologia: fundo quase preto, brilhos de cor em camadas
// de opacidade e rótulos em fonte mono. Inter para tudo que se lê; Andale Mono para metadados.
export const tokens = defineTokens({
  color: {
    void: '#07080F',
    surface: '#10121E',
    raised: '#171A2B',
    line: '#262A44',
    text: '#F2F3FA',
    muted: '#8D92B2',
    violet: '#8B5CF6',
    cyan: '#22D3EE',
    lime: '#A3E635',
    pink: '#F472B6',
  },
  font: { hero: 76, h1: 30, h2: 15, body: 13, small: 11, micro: 8.5 },
  space: { page: 48, gap: 14 },
});

export const theme = themeOf(tokens, {
  name: 'Nebula',
  colors: { dark1: 'color.void', light1: 'color.text', dark2: 'color.surface', light2: 'color.muted', accent1: 'color.violet', accent2: 'color.cyan', accent3: 'color.lime', accent4: 'color.pink' },
  fonts: { heading: 'Inter', body: 'Inter' },
});
