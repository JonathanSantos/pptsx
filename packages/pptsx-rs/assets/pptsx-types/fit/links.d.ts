import type { Diagnostic, PositionedSlide } from '../core/types.ts';
export interface LinkedDeck {
    readonly slides: readonly PositionedSlide[];
    readonly diagnostics: readonly Diagnostic[];
}
/** `slides` = deck de saída; `authorSlides` = quantos slides o <Deck> do autor tem. */
export declare const linkDeck: (slides: readonly PositionedSlide[], authorSlides: number, size: string) => LinkedDeck;
