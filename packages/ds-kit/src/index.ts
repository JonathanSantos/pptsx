/**
 * @pptsx/ds-kit — ferramentas para criar um design system sobre o pptsx usando só a API pública dele:
 * tokens, tema, variantes, slots, regras de lint, catálogo e o manifesto do DS.
 */
export { defineTokens, colorsOf, type TokenSource, type TokenTree, type Tokens } from './tokens.ts';
export { themeOf, checkTheme, contrastOf, AA_TEXT, AA_LARGE, type ThemeMap } from './theme.ts';
export { createVariants, type VariantConfig, type VariantDefs, type VariantSelection } from './variants.ts';
export { slot, filledSlots, type Slots } from './slots.ts';
export { defineRule, colorsFromTokens, fontsFromTheme, maxChildren, onlyOnSlide, paintedColorsOf } from './rules.ts';
export { createDs, guideOf, metaOfComponent, type CatalogCase, type Ds, type DsInput, type GuidePart } from './ds.ts';
export { catalog, compareFrames, type CatalogDiff, type CatalogOptions, type CatalogResult, type ComponentFixture, type FrameFixture } from './catalog.ts';
export { schemaOf, type ComponentSchema } from './schema.ts';
// Do núcleo, para o DS importar tudo de um lugar.
export { defineComponent, defineDs, defineLayout, type ComponentMeta, type DsManifest, type LintRule } from 'pptsx';
