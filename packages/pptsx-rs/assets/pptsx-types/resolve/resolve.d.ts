import type { ResponsiveContext } from '../core/responsive.ts';
import { type ResolveEnv } from './icon.ts';
import type { ResolvedDeck, SlideElement } from '../core/types.ts';
/**
 * M19: medida de um `<Container>` feita pela passada anterior: o frame (border-box, que o Box fixa) e a content
 * box (o que a função recebe). Chave: `containerKeyOf(slide, path)`.
 */
export interface ContainerMeasure {
    readonly frame: {
        readonly width: number;
        readonly height: number;
    };
    readonly content: {
        readonly width: number;
        readonly height: number;
    };
}
export type ContainerMeasures = ReadonlyMap<string, ContainerMeasure>;
/** Slide (índice do autor, base 0) + path: o path sozinho se repete entre slides. */
export declare const containerKeyOf: (slideIndex: number, path: string) => string;
/** Valores responsivos são resolvidos aqui para `ctx`; a árvore resolvida só tem valores concretos. */
export declare const resolveDeck: (root: SlideElement, responsive: ResponsiveContext, env?: ResolveEnv, containers?: ContainerMeasures) => ResolvedDeck;
