import { defineTokens, themeOf } from '@pptsx/ds-kit';

// Botânica · DS de relatório de impacto: verde-floresta, musgo, sálvia e areia, com terracota
// para o que precisa saltar. Big Caslon nos títulos e números; Inter no texto. Folhas e colinas
// são elipses giradas: nada de imagem, tudo forma nativa.
export const tokens = defineTokens({
  color: { forest: '#1E3A2A', moss: '#5E8A4A', sage: '#B7C9A2', sand: '#EFE6D4', cream: '#FAF6EC', clay: '#C2623C', bark: '#6B5640', ink: '#22301F' },
  font: { hero: 54, h1: 32, number: 58, body: 11, small: 8.5 },
  space: { page: 46, gap: 16 },
});

export const theme = themeOf(tokens, {
  name: 'Botânica',
  colors: { dark1: 'color.ink', light1: 'color.cream', dark2: 'color.forest', light2: 'color.sand', accent1: 'color.moss', accent2: 'color.clay', accent3: 'color.sage', accent4: 'color.bark' },
  fonts: { heading: 'Big Caslon', body: 'Inter' },
});
