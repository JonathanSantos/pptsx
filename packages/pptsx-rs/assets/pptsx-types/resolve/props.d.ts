import type { ResponsiveContext } from '../core/responsive.ts';
import type { PrimitiveKind, SlideElement } from '../core/types.ts';
/** Props do autor já com valores concretos (nomes CSS, antigos ou da primitiva; ainda não normalizadas). */
export type RawProps = Readonly<Record<string, unknown>>;
/**
 * Props do nó sem children, com cada valor responsivo resolvido para o ctx, inclusive dentro
 * de `style`. O que resolve para undefined some do objeto: o resto do pipeline trata como
 * "autor não escreveu".
 */
export declare const resolvePropsOf: (element: SlideElement, kind: PrimitiveKind, path: string, ctx: ResponsiveContext) => RawProps;
