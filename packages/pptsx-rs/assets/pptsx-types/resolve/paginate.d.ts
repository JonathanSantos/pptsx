import type { CssStyle, ResolvedSlide } from '../core/types.ts';
/** M16: a posição vem do CSS (as props do nó não guardam geometria). */
type Position = CssStyle['position'];
/** Decoração absoluta não participa do fluxo, então não tem filhos "a mais" para mandar ao próximo slide. */
export declare const assertPaginateInFlow: (props: {
    readonly paginate?: boolean;
}, position: Position, path: string) => void;
export declare const assertSinglePaginate: (slide: ResolvedSlide) => void;
/** M13: Text paginate em absoluto ou com maxLines não tem para onde continuar. */
export declare const assertTextPaginate: (props: {
    readonly paginate?: boolean;
    readonly maxLines?: number;
}, position: Position, path: string) => void;
/** M14: Table paginate em absoluto não tem para onde continuar. */
export declare const assertTablePaginate: (props: {
    readonly paginate?: boolean;
}, position: Position, path: string) => void;
export {};
