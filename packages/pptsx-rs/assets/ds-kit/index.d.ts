/**
 * @pptsx/ds-kit, as partes de build embutidas no pptsx-rs: tokens, tema, variantes, slots, regras de lint e o
 * manifesto do DS. `pptsx-rs init`/`types` gravam estes tipos em `.pptsx/types/@pptsx/ds-kit/`.
 */
export { defineTokens, colorsOf, type TokenSource, type TokenTree, type Tokens } from './tokens.ts';
export { themeOf, checkTheme, contrastOf, AA_TEXT, AA_LARGE, type ThemeMap } from './theme.ts';
export { createVariants, type PropsFor, type VariantConfig, type VariantDefs, type VariantProps, type VariantSelection, type VariantTarget } from './variants.ts';
export { slot, filledSlots, type Slots } from './slots.ts';
export { defineRule, colorsFromTokens, fontsFromTheme, maxChildren, onlyOnSlide, paintedColorsOf } from './rules.ts';
export { createDs, componentGuides, guideOf, metaOfComponent, schemaFromMeta, type CatalogCase, type Ds, type DsInput, type GuidePart } from './ds.ts';
export { defineComponent, defineDs, defineLayout, type ComponentMeta, type DsManifest, type LintRule } from 'pptsx';
