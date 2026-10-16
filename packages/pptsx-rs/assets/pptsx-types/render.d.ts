import type { DeckDefinition, Diagnostic, FontFace, RenderOptions, RenderResult, PositionedSlide, SizeSpec, ResolvedDeck, SlideElement, Theme, SlideSize } from './core/types.ts';
/**
 * M19: o deck resolvido de um tamanho com os Containers já medidos (interno: o lint roda as regras dos DS nele,
 * para enxergar o conteúdo que só existe depois da medição).
 */
export declare const resolveMeasured: (deck: DeckDefinition, spec: SizeSpec, options?: RenderOptions) => ResolvedDeck;
/** API programática: nunca grava arquivo nem imprime. */
export declare const render: (deck: DeckDefinition, options?: RenderOptions) => Promise<RenderResult[]>;
export interface FragmentOptions {
    readonly size: SizeSpec;
    /** Margem do slide em volta do elemento (pt). Padrão DEFAULTS.fragment.padding. */
    readonly padding?: number;
    readonly fonts?: readonly FontFace[];
    readonly theme?: Theme;
    readonly baseDir?: string;
    readonly lang?: string;
    /** Também rasteriza (PNG); padrão false (o SVG sempre sai). */
    readonly png?: boolean;
    /** Largura do SVG/PNG em px; padrão DEFAULTS.preview.width. */
    readonly widthPx?: number;
    /**
     * true: o elemento é filho direto do Slide (um `flex={1}` ocupa a altura toda — componentes feitos
     * para preencher o corpo). Padrão false: o elemento fica num Box do tamanho do conteúdo, e o
     * catálogo mostra o tamanho natural dele.
     */
    readonly fill?: boolean;
}
export interface FragmentResult {
    readonly size: SlideSize;
    readonly slide: PositionedSlide;
    readonly diagnostics: readonly Diagnostic[];
    readonly svg: string;
    readonly png?: Buffer;
}
/**
 * M17: um elemento sozinho num slide do tamanho pedido, sem gravar nada — a base do catálogo de
 * componentes de um DS. O elemento vai dentro de um Slide em coluna com `padding`; um fragmento não
 * pagina (um `paginate` dentro dele é medido como no slide, mas só a 1ª parte volta).
 */
export interface FragmentSlideOptions {
    readonly padding?: number;
    readonly fill?: boolean;
    /** M18: rótulo pequeno no canto (absoluto, na margem): não muda a posição do elemento. */
    readonly label?: string;
}
/**
 * M18: o Slide de um fragmento, o mesmo do `renderFragment` — para montar um deck de catálogo com a
 * mesma moldura dos PNGs e das fixtures. O elemento vem primeiro; o rótulo, depois e absoluto.
 */
export declare const fragmentSlide: (element: SlideElement, options?: FragmentSlideOptions) => SlideElement;
export declare const renderFragment: (element: SlideElement, options: FragmentOptions) => Promise<FragmentResult>;
