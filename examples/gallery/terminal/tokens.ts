import { defineTokens, themeOf } from '@pptsx/ds-kit';

// Terminal · DS de engenharia: tudo em Andale Mono, fundo de fósforo apagado e cor só para estado
// (verde ok, âmbar atenção, vermelho erro). A moldura de janela e o prompt são a assinatura.
export const tokens = defineTokens({
  color: { bg: '#0A0D09', panel: '#10150E', line: '#263021', text: '#D5E2CF', dim: '#6E7F68', green: '#5EE38B', amber: '#F5C152', red: '#FF6B6B', blue: '#7AB8FF' },
  font: { hero: 58, h1: 22, body: 11.5, small: 9.5 },
  space: { page: 26, gap: 12 },
});

export const theme = themeOf(tokens, {
  name: 'Terminal',
  colors: { dark1: 'color.bg', light1: 'color.text', dark2: 'color.panel', light2: 'color.dim', accent1: 'color.green', accent2: 'color.amber', accent3: 'color.red', accent4: 'color.blue' },
  fonts: { heading: 'Andale Mono', body: 'Andale Mono' },
});
