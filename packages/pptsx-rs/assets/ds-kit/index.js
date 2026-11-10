/**
 * @pptsx/ds-kit, as partes de build embutidas no pptsx-rs: tokens, tema, variantes, slots, regras de lint e o
 * manifesto do DS. O binário serve este módulo para `import … from '@pptsx/ds-kit'` sem node_modules.
 * Catálogo visual, scaffold e skill do kit em Node ficam de fora: o binário faz esse papel (`init --ds`,
 * `skill --ds`, e o schema das props lido das interfaces do DS).
 */
export { defineTokens, colorsOf } from './tokens.js';
export { themeOf, checkTheme, contrastOf, AA_TEXT, AA_LARGE } from './theme.js';
export { createVariants } from './variants.js';
export { slot, filledSlots } from './slots.js';
export { defineRule, colorsFromTokens, fontsFromTheme, maxChildren, onlyOnSlide, paintedColorsOf } from './rules.js';
export { createDs, componentGuides, guideOf, metaOfComponent, schemaFromMeta } from './ds.js';
// Do núcleo, para o DS importar tudo de um lugar.
export { defineComponent, defineDs, defineLayout } from 'pptsx';
