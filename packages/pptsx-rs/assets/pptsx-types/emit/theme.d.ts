import type { ResolvedTheme } from '../core/types.ts';
export declare const colorSchemeXmlOf: (theme: ResolvedTheme) => string;
/** `theme1.xml` com o nome, as 12 cores e as fontes de título (major) e corpo (minor) do tema. */
export declare const themeXmlOf: (xml: string, theme: ResolvedTheme) => string;
/** Hex (sem '#', maiúsculo) → valor do `<a:schemeClr>`; empate de hex: a 1ª cor na ordem de DEFAULTS.theme.schemes. */
export declare const schemeMapOf: (theme: ResolvedTheme) => ReadonlyMap<string, string>;
export declare const applyThemeColors: (xml: string, schemes: ReadonlyMap<string, string>) => string;
/** Família → fonte do tema; com título e corpo iguais, vale a de corpo (+mn-lt). */
export declare const themeFontMapOf: (theme: ResolvedTheme) => ReadonlyMap<string, string>;
export declare const applyThemeFonts: (xml: string, fonts: ReadonlyMap<string, string>) => string;
/** Aplica o tema ao pacote. Sem tema: o buffer volta intacto. */
export declare const applyTheme: (buffer: Buffer, theme: ResolvedTheme | undefined) => Promise<Buffer>;
