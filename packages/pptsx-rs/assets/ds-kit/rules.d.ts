import type { LintContext, LintRule, ResolvedNode, ResolvedSlide, RuleFinding, Severity, Theme } from 'pptsx';
import { type TokenSource } from './tokens.ts';
/** Regras de lint para DS: `defineRule` e regras prontas (prefixe o id com o nome do DS). */
type Node = ResolvedNode | ResolvedSlide;
export declare const defineRule: (id: string, severity: Severity, check: (node: Node, ctx: LintContext) => readonly RuleFinding[]) => LintRule;
/** Cores que o nó pinta: fundo, bordas, contorno, cor de texto e dos trechos, fill/stroke de forma. */
export declare const paintedColorsOf: (node: Node) => readonly string[];
/** Toda cor pintada tem que estar nos tokens (hex solto no deck vira achado). */
export declare const colorsFromTokens: (id: string, tokens: TokenSource, severity?: Severity) => LintRule;
/** Texto só nas famílias do tema (título/corpo). */
export declare const fontsFromTheme: (id: string, theme: Theme, severity?: Severity) => LintRule;
/** O componente aceita no máximo n filhos. */
export declare const maxChildren: (id: string, component: string, max: number, severity?: Severity) => LintRule;
/** O componente só pode aparecer no slide `index` do autor (base 1). */
export declare const onlyOnSlide: (id: string, component: string, index: number, severity?: Severity) => LintRule;
export {};
