import type { ResponsiveContext } from './core/responsive.ts';
import type { Diagnostic, LayoutEnv, ResolvedDeck, SlideElement, SlideSize } from './core/types.ts';
import { type ResolveEnv } from './resolve/index.ts';
/**
 * M19: resolve com `<Container>`. Cada passada resolve o deck com as medidas que já existem, faz o layout só dos
 * slides que ainda têm Container sem medida, mede o espaço de cada um e resolve de novo. Slides sem Container não
 * passam por aqui duas vezes: com nada pendente, a 1ª passada já é a final (custo e saída de antes).
 */
export interface ContainersResult {
    readonly deck: ResolvedDeck;
    readonly diagnostics: readonly Diagnostic[];
}
export interface ContainersInput {
    readonly root: SlideElement;
    readonly responsive: ResponsiveContext;
    readonly resolveEnv?: ResolveEnv;
    readonly size: SlideSize;
    readonly layoutEnv: LayoutEnv;
}
export declare const resolveWithContainers: ({ root, responsive, resolveEnv, size, layoutEnv }: ContainersInput) => ContainersResult;
