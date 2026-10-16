import type { FlexDirection, PositionedBox, PositionedNode, PositionedSlide, Rect } from '../core/types.ts';
export type Container = PositionedSlide | PositionedBox;
export type Axis = 'width' | 'height';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface Excess {
    readonly pt: number;
    readonly axis: Axis;
}
export interface SideExcess {
    readonly side: Side;
    readonly pt: number;
}
export declare const isInFlow: (node: PositionedNode) => boolean;
export declare const isBox: (node: PositionedNode) => node is PositionedBox;
/** Quanto `inner` passa de `outer` em cada lado (só os lados que passam). */
export declare const sidesOutside: (inner: Rect, outer: Rect) => readonly SideExcess[];
/** O maior estouro de `inner` em relação a `outer`, com o eixo em que acontece. */
export declare const excessOf: (inner: Rect, outer: Rect) => Excess;
export declare const largest: (excesses: readonly Excess[]) => Excess;
export declare const contentOf: (node: Container | PositionedNode) => Rect;
/** M11: caixa de margem (frame + margens); é o que o filho ocupa no contêiner. */
export declare const marginBoxOf: (node: PositionedNode) => Rect;
/** M11: soma das margens verticais (a demanda de altura de um filho inclui as dele). */
export declare const verticalMarginOf: (node: PositionedNode) => number;
export interface ContainerExcess extends Excess {
    /** Tamanho da área de conteúdo no eixo do estouro. */
    readonly available: number;
    readonly direction: FlexDirection;
    /** M11: grade ou flex com wrap (as linhas se empilham; a mensagem fala delas). */
    readonly layout?: 'grid' | 'wrap';
}
/** Estouro dos filhos em fluxo sobre a área de conteúdo, ignorando os já explicados. */
export declare const containerExcessOf: (container: Container, explained: ReadonlySet<string>) => ContainerExcess;
