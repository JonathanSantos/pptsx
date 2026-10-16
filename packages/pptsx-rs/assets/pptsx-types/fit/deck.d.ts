import type { Diagnostic, LayoutEnv, PositionedDeck, ResolvedDeck, SlideSize } from '../core/types.ts';
export interface FitDeckInput {
    readonly deck: ResolvedDeck;
    readonly size: SlideSize;
    readonly env: LayoutEnv;
}
export interface FitDeckResult {
    readonly positioned: PositionedDeck;
    readonly diagnostics: readonly Diagnostic[];
}
/** Layout + ajuste de cada slide, já paginado: o deck de saída pode ter mais slides que o do autor. */
export declare const fitDeck: ({ deck, size, env }: FitDeckInput) => FitDeckResult;
