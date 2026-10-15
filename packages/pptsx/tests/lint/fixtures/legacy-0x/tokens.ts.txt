/** Tokens de design dos exemplos: cores, escala tipográfica (pt) e espaçamentos (pt). */
export const tokens = {
  color: { brand: '#1B2A4A', brandDark: '#101B33', accent: '#2F6FED', accentSoft: '#E8EEFC',
           ink: '#1B2A4A', muted: '#5B6680', surface: '#F4F6FA', white: '#FFFFFF',
           positive: '#1E9E6A', negative: '#D64545' },
  font: { display: 44, h1: 32, h2: 24, body: 20, small: 14, caption: 11 },
  space: { page: 40, gap: 20, tight: 10 },
} as const;

export type Tokens = typeof tokens;
