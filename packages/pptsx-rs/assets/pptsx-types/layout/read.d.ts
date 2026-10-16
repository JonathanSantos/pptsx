import type { Node as YogaNode } from 'yoga-layout';
import type { BoxMetrics, LayoutEnv, PositionedNode, Rect, ResolvedNode } from '../core/types.ts';
import type { BuiltNode } from './tree.ts';
interface Origin {
    readonly x: number;
    readonly y: number;
}
/**
 * O Yoga devolve posições relativas ao pai; o contrato quer frames absolutos no slide.
 * `translate` (transform) é aplicado aqui, depois do layout, sem afetar irmãos (como o browser).
 */
export declare const frameOf: (yoga: YogaNode, origin: Origin, source: ResolvedNode) => Rect;
export declare const boxOf: (yoga: YogaNode) => BoxMetrics;
/** Área de conteúdo: frame − borda − padding. */
export declare const contentRectOf: (frame: Rect, box: BoxMetrics) => Rect;
export declare const readChildren: (children: readonly BuiltNode[], origin: Origin, env: LayoutEnv) => readonly PositionedNode[];
export {};
