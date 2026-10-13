import { FRAGMENT, PRIMITIVE_KIND } from '../core/types.ts';
import type { Child, Component, Primitive, PrimitiveKind, SlideElement } from '../core/types.ts';
import { isPrimitive, primitiveName } from '../primitives/index.ts';

/** Primitiva já desembrulhada de componentes/fragments, com o segmento de path que vai receber. */
export interface ExpandedPrimitive {
  readonly type: 'primitive';
  readonly kind: PrimitiveKind;
  readonly element: SlideElement;
  readonly segment: string;
}

export interface ExpandedText {
  readonly type: 'text';
  readonly value: string | number;
}

export type Expanded = ExpandedPrimitive | ExpandedText;

const isElement = (child: Child): child is SlideElement =>
  typeof child === 'object' && child !== null && !Array.isArray(child);

const componentName = (component: Component): string => component.name || 'Anonymous';

const kindOf = (primitive: Primitive<PrimitiveKind>): PrimitiveKind => primitive[PRIMITIVE_KIND];

/**
 * Achata a árvore até primitivas e textos soltos. `outerName` carrega o nome do
 * componente mais externo, que vence o nome da primitiva no path.
 */
export const expandChild = (child: Child, outerName?: string): readonly Expanded[] => {
  if (child === null || child === undefined || typeof child === 'boolean') return [];
  if (typeof child === 'string' || typeof child === 'number') return [{ type: 'text', value: child }];
  if (Array.isArray(child)) return child.flatMap((item: Child) => expandChild(item, outerName));
  if (!isElement(child)) return [];
  return expandElement(child, outerName);
};

const expandElement = (element: SlideElement, outerName?: string): readonly Expanded[] => {
  const { type } = element;
  if (type === FRAGMENT) return expandChild(element.props.children, outerName);
  if (isPrimitive(type)) {
    const kind = kindOf(type);
    return [{ type: 'primitive', kind, element, segment: outerName ?? primitiveName(kind) }];
  }
  return expandChild(type(element.props), outerName ?? componentName(type));
};
