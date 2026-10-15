import type { Diagnostic, LayoutEnv, PositionedDeck, PositionedSlide, ResolvedDeck, ResolvedNode, ResolvedSlide, SlideSize } from '../core/types.ts';
import { routeConnectors } from './connectors.ts';
import { linkDeck } from './links.ts';
import { numberSlides } from './slide-number.ts';
import { placeholderUnused, withSourceSlide } from './diagnostics.ts';
import { unusedPlaceholdersOf } from '../resolve/index.ts';
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

const idsOf = (nodes: readonly ResolvedNode[]): readonly string[] =>
  nodes.flatMap((node) => [...(node.props.id === undefined ? [] : [node.props.id]), ...(node.kind === 'box' ? idsOf(node.children) : [])]);

/** M12: conectores roteados depois do ajuste de cada parte (não mexem no layout). */
const withConnectors = (results: readonly FitResult[], slide: ResolvedSlide, firstIndex: number, input: Omit<FitDeckInput, 'deck'>): readonly FitResult[] => {
  const { connectors } = slide;
  if (connectors === undefined || connectors.length === 0) return results;
  const knownIds = idsOf(slide.children);
  return results.map((result, part) => {
    const ctx = { size: input.size.name, slide: firstIndex + part + 1 };
    const routed = routeConnectors({ slide: result.slide, connectors, env: input.env, ctx, knownIds, firstPart: part === 0 });
    const positioned = routed.connectors.length === 0 ? result.slide : { ...result.slide, connectors: routed.connectors };
    return { slide: positioned, diagnostics: [...result.diagnostics, ...routed.diagnostics] };
  });
};

/** Layout + ajuste de cada slide, já paginado: o deck de saída pode ter mais slides que o do autor. */
export const fitDeck = ({ deck, size, env }: FitDeckInput): FitDeckResult => {
  const fitted = deck.slides.reduce<Fitted>(
    (done, slide) => {
      const slideIndex = done.slides.length;
      const results = withConnectors(paginateSlide({ slide, slideIndex, size, env }), slide, slideIndex, { size, env });
      return {
        slides: [...done.slides, ...results.map((result) => result.slide)],
        diagnostics: [...done.diagnostics, ...withSources(results, slideIndex, slide.sourceSlide)],
      };
    },
    { slides: [], diagnostics: [] },
  );
  // M13: links slide:N do autor → slide de saída (a paginação já aconteceu).
  const linked = linkDeck(fitted.slides, deck.slides.length, size.name);
  // M13: números de slide do deck de saída (as partes paginadas contam).
  const numbered = numberSlides(linked.slides, env);
  const positioned: PositionedDeck = { size, slides: numbered, ...(deck.sections === undefined ? {} : { sections: deck.sections }) };
  return { positioned, diagnostics: [...fitted.diagnostics, ...linked.diagnostics, ...layoutDiagnosticsOf(deck, numbered, size)] };
};

/** M15: um `placeholder-unused` por layout, olhando o 1º slide que o usa (é dele que saem as posições). */
const layoutDiagnosticsOf = (deck: ResolvedDeck, output: readonly PositionedSlide[], size: SlideSize): readonly Diagnostic[] => {
  const firsts = deck.slides.filter((slide, index) =>
    slide.layout !== undefined && deck.slides.findIndex((other) => other.layout?.name === slide.layout?.name) === index,
  );
  return firsts.flatMap((slide) => {
    const layout = slide.layout!;
    const unused = unusedPlaceholdersOf(slide.children, layout);
    if (unused.length === 0) return [];
    // O diagnóstico aponta a 1ª parte desse slide no deck de saída (a paginação desloca os números).
    const outputSlide = output.findIndex((part) => part.sourceSlide === slide.sourceSlide) + 1;
    return [placeholderUnused({ size: size.name, slide: outputSlide }, slide.path, layout.name, unused)];
  });
};
