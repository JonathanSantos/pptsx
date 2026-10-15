import { colorsFromTokens, defineRule } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

export const rules = [
  colorsFromTokens('aurora-ds/cores', tokens),
  // Hero é capa: fora da abertura ele compete com o título do slide
  defineRule('aurora-ds/hero-so-na-capa', 'error', (_node, ctx) =>
    ctx.component?.name === 'Hero' && ctx.slide !== 1
      ? [{ message: `Hero só no slide 1 (encontrado no slide ${ctx.slide}).` }]
      : []),
];
