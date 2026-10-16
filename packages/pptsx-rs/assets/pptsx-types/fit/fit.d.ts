import type { Diagnostic, LayoutEnv, PositionedSlide, ResolvedSlide, SlideSize } from '../core/types.ts';
export interface FitInput {
    readonly slide: ResolvedSlide;
    readonly slideIndex: number;
    readonly size: SlideSize;
    readonly env: LayoutEnv;
}
export interface FitResult {
    readonly slide: PositionedSlide;
    readonly diagnostics: readonly Diagnostic[];
}
/**
 * Loop de ajuste: layout → detectar → por escopo disparado, busca binária do menor
 * delta de shrink (um layout por tentativa) → repetir em rodadas até nada disparar.
 * A bisseção troca os N layouts do passo de 1 pt por ~log2(N), e o piso pela palavra
 * partida pula direto ao size em que ela cabe. Depois: truncate + relayout final,
 * diagnósticos, causa (quem tomou o espaço) e agrupamento de irmãos iguais.
 *
 * `frozenScope` (interno, paginação): os Text/Table dentro dele não disparam nem entram em
 * busca de shrink; truncate e diagnósticos continuam valendo para eles.
 */
export declare const fitSlideFrozen: (input: FitInput, frozenScope: string | undefined) => FitResult;
export declare const fitSlide: (input: FitInput) => FitResult;
