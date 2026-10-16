import { defineTokens, themeOf } from '@pptsx/ds-kit';

// Forma · DS de inspiração Bauhaus: papel cru, preto e as três primárias. Tudo é forma nativa
// (círculo, triângulo, retângulo) e a tipografia é DIN Condensed em caixa alta, com Inter no texto miúdo.
export const tokens = defineTokens({
  color: { paper: '#EFE8DA', black: '#141414', red: '#E1341E', blue: '#1F4FBF', yellow: '#F2B705', white: '#FFFFFF' },
  font: { giant: 112, display: 64, title: 40, label: 18, body: 11, micro: 8 },
  space: { page: 40, gap: 12 },
});

export const theme = themeOf(tokens, {
  name: 'Forma',
  colors: { dark1: 'color.black', light1: 'color.white', light2: 'color.paper', accent1: 'color.red', accent2: 'color.blue', accent3: 'color.yellow' },
  fonts: { heading: 'DIN Condensed', body: 'Inter' },
});
