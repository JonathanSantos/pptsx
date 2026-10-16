import type { PositionedNode, PositionedSlide, Rect } from '../core/types.ts';
/**
 * Ordem de pintura e transformações herdadas (M11; puro). O emissor e o preview iteram pelos
 * mesmos `PaintItem`s, nunca pela árvore, para desenharem a mesma coisa.
 *
 * Regra (subconjunto do CSS 2.1 Apêndice E + CSS Flexbox §4.3):
 * - Itens de flex/grid pintam atomicamente, na ordem da árvore (como inline-blocks).
 * - Um nó "sobe de camada" quando é posicionado (relative/absolute), tem zIndex (item de
 *   flex/grid respeita z mesmo static), opacity < 1 ou transform. Ele pinta com a sua
 *   subárvore numa camada do contexto de empilhamento mais próximo: z negativo antes do
 *   fluxo, z 0/auto depois do fluxo (ordem da árvore), z positivo por último (z crescente,
 *   estável). Descendentes que sobem de camada dentro de um item atômico continuam no
 *   contexto de fora, como no browser.
 * - Simplificação: posicionado com z auto cria contexto próprio (z 0); no browser os
 *   posicionados dentro dele participariam do contexto de fora.
 */
export interface Rotation {
    readonly degrees: number;
    readonly cx: number;
    readonly cy: number;
}
export interface PaintItem {
    readonly node: PositionedNode;
    /** Opacidade efetiva (produto dos ancestrais e do próprio nó): o PPTX não tem opacidade de grupo. */
    readonly opacity: number;
    /** Rotações a aplicar, da mais externa (ancestral) à do próprio nó. */
    readonly rotations: readonly Rotation[];
    /** Índice do nó em pré-ordem da árvore (ids únicos no SVG). */
    readonly index: number;
}
export declare const paintOrderOf: (slide: PositionedSlide) => readonly PaintItem[];
export interface Placement {
    readonly frame: Rect;
    /** Graus, horário; 0 = sem rotação. */
    readonly rotate: number;
}
/**
 * O PPTX não tem grupo girado: cada forma recebe a soma das rotações e o centro levado pelas
 * rotações dos ancestrais (a mais interna primeiro). O tamanho não muda.
 */
export declare const placementOf: (frame: Rect, rotations: readonly Rotation[]) => Placement;
