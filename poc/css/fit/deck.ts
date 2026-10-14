// PoC CSS: cópia de src/fit/deck.ts com os tipos da PoC (nós com css); adaptações marcadas com 'PoC:'.
import type { Diagnostic, LayoutEnv, PositionedDeck, PositionedSlide, ResolvedDeck, SlideSize } from '../types.ts';
import { withSourceSlide } from './diagnostics.ts';
import type { FitResult } from './fit.ts';
import { paginateSlide } from './paginate.ts';

export interface FitDeckInput {
  readonly deck: ResolvedDeck;
  readonly size: SlideSize;
  readonly env: LayoutEnv;
}

export interface FitDeckResult {
  readonly positioned: PositionedDeck;
  readonly diagnostics: readonly Diagnostic[];
}

interface Fitted {
  readonly slides: readonly PositionedSlide[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * `slide` é o índice no deck de saída; quando ele deixa de bater com o do autor (ou o slide
 * é uma parte de paginação), `data.sourceSlide` diz ao autor qual slide do deck dele editar.
 */
const withSources = (results: readonly FitResult[], firstIndex: number, sourceSlide: number): readonly Diagnostic[] => {
  const paginated = results.length > 1;
  return results.flatMap(({ diagnostics }, part) =>
    paginated || firstIndex + part + 1 !== sourceSlide ? diagnostics.map((d) => withSourceSlide(d, sourceSlide)) : diagnostics,
  );
};

/** Layout + ajuste de cada slide, já paginado: o deck de saída pode ter mais slides que o do autor. */
export const fitDeck = ({ deck, size, env }: FitDeckInput): FitDeckResult => {
  const fitted = deck.slides.reduce<Fitted>(
    (done, slide) => {
      const slideIndex = done.slides.length;
      const results = paginateSlide({ slide, slideIndex, size, env });
      return {
        slides: [...done.slides, ...results.map((result) => result.slide)],
        diagnostics: [...done.diagnostics, ...withSources(results, slideIndex, slide.sourceSlide)],
      };
    },
    { slides: [], diagnostics: [] },
  );
  return { positioned: { size, slides: fitted.slides }, diagnostics: fitted.diagnostics };
};
