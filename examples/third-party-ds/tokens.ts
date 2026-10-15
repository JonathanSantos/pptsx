import { defineTokens, themeOf, checkTheme } from '@pptsx/ds-kit';

export const tokens = defineTokens({
  color: {
    ink: '#1B1F3B',
    paper: '#FFFFFF',
    aurora: '#0E7C73',
    glow: '#2EC4B6',
    violet: '#6A4C93',
    mist: '#EEF4F8',
    up: '#1B7F5B',
    down: '#C1121F',
  },
  font: { hero: 54, title: 32, stat: 40, body: 18, small: 13 },
  space: { page: 48, gap: 20, inner: 18 },
});

export const theme = themeOf(tokens, {
  name: 'Aurora',
  colors: { dark1: 'color.ink', light1: 'color.paper', accent1: 'color.aurora', accent2: 'color.violet', light2: 'color.mist', accent3: 'color.up', accent4: 'color.down', accent5: 'color.glow' },
  fonts: { heading: 'Arial', body: 'Arial' },
});

export const themeWarnings = checkTheme(theme);
