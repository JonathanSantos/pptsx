import type { LayoutEnv, ResolvedBox, ResolvedNode } from '../core/types.ts';
export declare const horizontalBoxOf: (node: ResolvedNode) => number;
export declare const horizontalMarginOf: (node: ResolvedNode) => number;
/** Min-content do border-box (sem margens). `gridMin` vem do grid-layout (evita import circular). */
export declare const minContentWidthOf: (node: ResolvedNode, env: LayoutEnv, gridMin: (box: ResolvedBox) => number) => number;
