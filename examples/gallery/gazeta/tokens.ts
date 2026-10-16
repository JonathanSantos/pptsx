import { defineTokens, themeOf } from '@pptsx/ds-kit';

// Gazeta · DS editorial de jornal: papel creme, tinta quase preta, um vermelho só para o que
// importa. Georgia em títulos e corpo; Inter em caixa alta para chapéus e créditos. Fios (bordas)
// fazem o papel de diagramação: duplo no cabeçalho, simples entre colunas.
export const tokens = defineTokens({
  color: { paper: '#F3EEE4', ink: '#17140F', red: '#C2311B', gray: '#6D675C', rule: '#CFC6B5', tint: '#E8E0D0' },
  font: { mast: 50, head: 30, deck: 15, body: 10.5, kicker: 7.5 },
  space: { page: 40, col: 18 },
});

export const theme = themeOf(tokens, {
  name: 'Gazeta',
  colors: { dark1: 'color.ink', light1: 'color.paper', dark2: 'color.gray', light2: 'color.tint', accent1: 'color.red', accent2: 'color.rule' },
  fonts: { heading: 'Georgia', body: 'Georgia' },
});
