import type { PrimitiveKind } from '../core/types.ts';
/**
 * M16-5/M18-6: as props da 0.x removidas na 1.0 e a troca por CSS. O resolve recusa cada uma com a troca
 * (`RemovedPropError`) e o `pptsx lint --fix` / `--from 0.x` reescreve o fonte com esta tabela. Sem
 * `values`, só o nome muda; com `values`, o codemod só reescreve valor literal. Os casos especiais
 * (direction no Box, stroke/strokeWidth, background={{ image }}, italic) ficam no codemod.
 */
export interface AliasRule {
    readonly prop: string;
    readonly kinds: readonly PrimitiveKind[];
    /** Nome CSS que substitui. */
    readonly css: string;
    /** Valor antigo → valor CSS (literal). Ausente = mesmo valor. */
    readonly values?: Readonly<Record<string, string>>;
    /** Precisa de tratamento próprio no codemod. */
    readonly special?: 'direction-box' | 'stroke' | 'background' | 'italic' | 'grow';
}
export declare const ALIAS_RULES: readonly AliasRule[];
export declare const aliasRuleOf: (kind: PrimitiveKind, prop: string) => AliasRule | undefined;
/** Como o lint escreve a troca sugerida ("direction="row" → display="flex""). */
export declare const suggestionOf: (rule: AliasRule, value: unknown) => string;
