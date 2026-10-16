import type { Diagnostic, PositionedDeck, Rect, RenderResult } from '../../core/types.ts';
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
export declare const sizeStatesOf: (results: readonly RenderResult[]) => readonly SizeState[];
/** O que a página precisa em JSON (sem os SVGs): tamanhos, slides com os frames por path e os diagnósticos. */
export declare const stateJsonOf: (state: PreviewState) => unknown;
export interface SvgRequest {
    readonly size: string;
    readonly slide: number;
    readonly debug: boolean;
}
export declare const slideSvgOf: (state: PreviewState, request: SvgRequest, options: {
    readonly baseDir: string;
    readonly fontFamilyMap?: Readonly<Record<string, string>>;
    readonly lang?: string;
    readonly widthPx: number;
}) => string | undefined;
/**
 * No browser a face de medição ("Liberation Sans") costuma não existir e o texto cairia numa serifada:
 * cada família ganha Arial (mesmas métricas) e sans-serif como reserva. Só no preview ao vivo; o PNG
 * (resvg) usa as fontes do registro.
 */
export declare const withFontFallback: (svg: string) => string;
