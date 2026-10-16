import { type Config, type Node as YogaNode } from 'yoga-layout';
import type { CssStyle, Dimensions, LayoutEnv, ResolvedNode } from '../core/types.ts';
import { type ParentLayout } from './style.ts';
/** Nó resolvido pareado com seu nó Yoga (e o que foi lido do env na construção). */
export interface BuiltNode {
    readonly source: ResolvedNode;
    readonly yoga: YogaNode;
    /** Na ordem da árvore resolvida (não na de `order`): o read e os paths seguem o autor. */
    readonly children: readonly BuiltNode[];
    readonly intrinsic?: Dimensions;
}
export interface BuildContext {
    readonly config: Config;
    readonly env: LayoutEnv;
    readonly parent: ParentLayout;
}
export declare const parentLayoutOf: (css: CssStyle, baseline: boolean) => ParentLayout;
/** Cria (e anexa ao `parent`) a subárvore Yoga dos filhos de um contêiner com estilo `css`. */
export declare const buildChildren: (children: readonly ResolvedNode[], parent: YogaNode, ctx: BuildContext, css: CssStyle) => readonly BuiltNode[];
