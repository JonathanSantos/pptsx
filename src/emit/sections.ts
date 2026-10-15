import { DEFAULTS } from '../core/defaults.ts';
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
export const outputSectionsOf = (deck: PositionedDeck): readonly OutputSection[] => {
  const sections = deck.sections ?? [];
  if (sections.length === 0) return [];
  const mapped = sections.map((section) => ({
    title: section.title,
    start: deck.slides.findIndex((slide) => slide.sourceSlide >= section.from),
  }));
  const first = mapped[0]!;
  return first.start > 0 ? [{ title: DEFAULTS.defaultSection, start: 0 }, ...mapped] : mapped;
};

/** Título da seção do slide de saída `index` (a última que começa nele ou antes). */
export const sectionTitleAt = (sections: readonly OutputSection[], index: number): string | undefined =>
  sections.reduce<string | undefined>((title, section) => (section.start <= index ? section.title : title), undefined);
