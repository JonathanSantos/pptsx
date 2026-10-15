import type { Diagnostic, PositionedDeck, PositionedNode, Rect, RenderResult } from '../../core/types.ts';
import { slideToSvg } from '../../preview/index.ts';

/**
 * M16-4: o estado do preview ao vivo — o último resultado de cada tamanho. O servidor não guarda
 * mais nada; o SVG de cada slide sai sob demanda (com ou sem debug) do deck posicionado.
 */

export interface NodeFrame {
  readonly path: string;
  readonly frame: Rect;
}

export interface SizeState {
  readonly size: string;
  readonly width: number;
  readonly height: number;
  readonly deck: PositionedDeck;
  readonly diagnostics: readonly Diagnostic[];
}

export interface PreviewState {
  /** Muda a cada rebuild: a página usa para furar o cache das imagens. */
  readonly version: number;
  readonly builtAt: string;
  readonly sizes: readonly SizeState[];
  /** Erro do último rebuild (sintaxe, estrutura): a página mostra e mantém o resultado anterior. */
  readonly error?: string;
}

export const sizeStatesOf = (results: readonly RenderResult[]): readonly SizeState[] =>
  results.flatMap((result) =>
    result.positioned === undefined
      ? []
      : [{ size: result.size, width: result.positioned.size.width, height: result.positioned.size.height, deck: result.positioned, diagnostics: result.diagnostics }],
  );

const framesOf = (nodes: readonly PositionedNode[]): readonly NodeFrame[] =>
  nodes.flatMap((node) => [{ path: node.path, frame: node.frame }, ...(node.kind === 'box' ? framesOf(node.children) : [])]);

/** O que a página precisa em JSON (sem os SVGs): tamanhos, slides com os frames por path e os diagnósticos. */
export const stateJsonOf = (state: PreviewState): unknown => ({
  version: state.version,
  builtAt: state.builtAt,
  ...(state.error === undefined ? {} : { error: state.error }),
  sizes: state.sizes.map((size) => ({
    size: size.size,
    width: size.width,
    height: size.height,
    slides: size.deck.slides.map((slide, index) => ({ number: index + 1, sourceSlide: slide.sourceSlide, nodes: framesOf(slide.children) })),
    diagnostics: size.diagnostics,
  })),
});

export interface SvgRequest {
  readonly size: string;
  readonly slide: number;
  readonly debug: boolean;
}

export const slideSvgOf = (state: PreviewState, request: SvgRequest, options: { readonly baseDir: string; readonly fontFamilyMap?: Readonly<Record<string, string>>; readonly lang?: string; readonly widthPx: number }): string | undefined => {
  const size = state.sizes.find((item) => item.size === request.size);
  const slide = size?.deck.slides[request.slide - 1];
  if (size === undefined || slide === undefined) return undefined;
  return withFontFallback(slideToSvg(slide, size.deck.size, { ...options, debug: request.debug }));
};

/**
 * No browser a face de medição ("Liberation Sans") costuma não existir e o texto cairia numa serifada:
 * cada família ganha Arial (mesmas métricas) e sans-serif como reserva. Só no preview ao vivo; o PNG
 * (resvg) usa as fontes do registro.
 */
export const withFontFallback = (svg: string): string => svg.replace(/font-family="([^"]*)"/g, (_whole, family: string) => `font-family="${family}, Arial, sans-serif"`);
