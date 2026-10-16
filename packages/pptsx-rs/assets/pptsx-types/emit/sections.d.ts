import type { PositionedDeck } from '../core/types.ts';
/** Seção já no deck de saída: começa no slide `start` (base 0) e vai até a próxima. */
export interface OutputSection {
    readonly title: string;
    readonly start: number;
}
/**
 * M15: `from` do autor → índice de saída (a 1ª parte do slide `from`, ou do primeiro slide do autor
 * a partir dele). Slides antes da 1ª seção ficam numa seção padrão: o PowerPoint quer todo slide
 * numa seção. Sem seções: lista vazia.
 */
export declare const outputSectionsOf: (deck: PositionedDeck) => readonly OutputSection[];
/** Título da seção do slide de saída `index` (a última que começa nele ou antes). */
export declare const sectionTitleAt: (sections: readonly OutputSection[], index: number) => string | undefined;
