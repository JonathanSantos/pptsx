import type { ArrowType, Color, LineStyle, Pt } from '../core/types.ts';
/**
 * Pontas de seta e traço de linha no preview (M12): polígonos explícitos, nunca `<marker>`
 * (lição do README: nem todo renderizador desenha marker com orientação automática). O
 * tamanho segue a ponta `med` do OOXML (arrowSizeOf), igual ao que o emissor grava.
 */
export interface Point {
    readonly x: Pt;
    readonly y: Pt;
}
/** Quanto a linha recua na ponta para o traço não passar da seta cheia. */
export declare const arrowInsetOf: (type: ArrowType | undefined, strokeWidth: Pt) => Pt;
/** A ponta no fim `tip` de um segmento que vem de `from`. */
export declare const arrowHeadSvg: (type: ArrowType | undefined, tip: Point, from: Point, strokeWidth: Pt, color: Color) => string;
/** Recua `tip` em direção a `from` (sem passar do meio do segmento). */
export declare const insetPoint: (tip: Point, from: Point, amount: Pt) => Point;
/**
 * `stroke-dasharray` do prstDash: dash = 4 × espessura com espaço 3 ×; sysDot = 1 × com espaço 1 ×.
 * Com ponta redonda o PPTX mantém o período e a ponta come metade da espessura de cada lado (o
 * pontilhado vira bolinhas), então o traço encolhe 1 × e o espaço cresce 1 ×.
 */
export declare const dashArrayOf: (style: LineStyle | undefined, strokeWidth: Pt, round?: boolean) => string | undefined;
