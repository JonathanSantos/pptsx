import type { DeckDefinition, RenderOptions, Severity, SizeSpec, Theme } from '../core/types.ts';
import type { LintRule } from './rule.ts';
/**
 * M16-5: `pptsx lint` — carrega e resolve o deck (sem gravar nada) e aponta o que vai dar trabalho:
 * props da 0.x (erro desde a 1.0, com a troca), CSS sem de/para, `lineHeight` numérico alto (o Keynote desce a 1ª linha),
 * `fr` solto em grid, cores fora do tema e erro de estrutura. Mensagens para LLM, como os diagnósticos.
 */
export type LintCode = 'structure' | 'legacy-prop' | 'css-not-emitted' | 'keynote-line-height' | 'grid-fr' | 'off-theme-color';
export interface LintFinding {
    readonly severity: Severity;
    /** Os da engine (LintCode) ou o `id` de uma regra externa (M17). */
    readonly code: LintCode | (string & {});
    /** Ausente quando vale para todos os tamanhos. */
    readonly size?: string;
    readonly slide: number;
    readonly path: string;
    readonly message: string;
}
export interface LintOptions {
    readonly sizes: readonly SizeSpec[];
    readonly baseDir: string;
    readonly theme?: Theme;
    readonly render?: Omit<RenderOptions, 'sizes' | 'preview' | 'includePositioned' | 'baseDir' | 'theme'>;
    /** M17: regras externas (config, DS), rodadas depois das da engine em cada tamanho. */
    readonly rules?: readonly LintRule[];
    /** M17: códigos que não saem (da engine ou de regras externas). */
    readonly disable?: readonly string[];
}
export declare const lintDeck: (deck: DeckDefinition, options: LintOptions) => Promise<readonly LintFinding[]>;
/** O path passa por um componente (um segmento que não é primitiva, ex.: `Risks`). */
export declare const isInsideComponent: (path: string) => boolean;
export declare const lintSummaryOf: (findings: readonly LintFinding[]) => string;
