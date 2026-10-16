import type { Child, ComponentMeta, LayoutDefinition, PrimitiveKind, SlideElement } from '../core/types.ts';
/** Primitiva já desembrulhada de componentes/fragments, com o segmento de path que vai receber. */
export interface ExpandedPrimitive {
    readonly type: 'primitive';
    readonly kind: PrimitiveKind;
    readonly element: SlideElement;
    readonly segment: string;
    /** M15: o layout (`defineLayout`) do componente que gerou este <Slide>; o mais interno vence. */
    readonly layout?: LayoutDefinition;
    /** M17: o componente mais externo que gerou a primitiva (o do segmento do path). */
    readonly component?: ComponentMeta;
    /** 1.0.5: `<Nome prop=valor … />` dessa instância (ResolvedBase.source). */
    readonly source?: string;
}
export interface ExpandedText {
    readonly type: 'text';
    readonly value: string | number;
}
export type Expanded = ExpandedPrimitive | ExpandedText;
/** O mais externo dá o nome do segmento e a identidade do nó. */
interface Outer {
    readonly name: string;
    readonly meta: ComponentMeta;
    readonly source?: string;
}
/**
 * Achata a árvore até primitivas e textos soltos. `outer` carrega o componente mais externo, cujo nome
 * vence o nome da primitiva no path e cuja identidade vai para o nó (M17).
 */
export declare const expandChild: (child: Child, outer?: Outer) => readonly Expanded[];
export {};
