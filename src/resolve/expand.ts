import { COMPONENT_META, FRAGMENT, LAYOUT_DEFINITION, PRIMITIVE_KIND } from '../core/types.ts';
import type { Child, Component, ComponentMeta, LayoutDefinition, Primitive, PrimitiveKind, SlideElement } from '../core/types.ts';
import { isPrimitive, primitiveName } from '../primitives/index.ts';

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
}

export interface ExpandedText {
  readonly type: 'text';
  readonly value: string | number;
}

export type Expanded = ExpandedPrimitive | ExpandedText;

const isElement = (child: Child): child is SlideElement =>
  typeof child === 'object' && child !== null && !Array.isArray(child);

/** M17: `defineComponent` dá o nome mesmo a HOC e função anônima; o resto usa o nome da função. */
const metaOf = (component: Component): ComponentMeta => component[COMPONENT_META] ?? { name: component.name || 'Anonymous' };

const segmentOf = (meta: ComponentMeta): string => meta.displayName ?? meta.name;

/** O mais externo dá o nome do segmento e a identidade do nó. */
interface Outer {
  readonly name: string;
  readonly meta: ComponentMeta;
}

const kindOf = (primitive: Primitive<PrimitiveKind>): PrimitiveKind => primitive[PRIMITIVE_KIND];

/**
 * Achata a árvore até primitivas e textos soltos. `outer` carrega o componente mais externo, cujo nome
 * vence o nome da primitiva no path e cuja identidade vai para o nó (M17).
 */
export const expandChild = (child: Child, outer?: Outer): readonly Expanded[] => {
  if (child === null || child === undefined || typeof child === 'boolean') return [];
  if (typeof child === 'string' || typeof child === 'number') return [{ type: 'text', value: child }];
  if (Array.isArray(child)) return child.flatMap((item: Child) => expandChild(item, outer));
  if (!isElement(child)) return [];
  return expandElement(child, outer);
};

const expandElement = (element: SlideElement, outer?: Outer): readonly Expanded[] => {
  const { type } = element;
  if (type === FRAGMENT) return expandChild(element.props.children, outer);
  if (isPrimitive(type)) {
    const kind = kindOf(type);
    return [{ type: 'primitive', kind, element, segment: outer?.name ?? primitiveName(kind), ...(outer === undefined ? {} : { component: outer.meta }) }];
  }
  const meta = metaOf(type);
  const items = expandChild(type(element.props), outer ?? { name: segmentOf(meta), meta });
  const layout = layoutOf(type);
  if (layout === undefined) return items;
  return items.map((item) => (item.type === 'primitive' && item.kind === 'slide' && item.layout === undefined ? { ...item, layout } : item));
};

const layoutOf = (component: Component): LayoutDefinition | undefined =>
  (component as { readonly [LAYOUT_DEFINITION]?: LayoutDefinition })[LAYOUT_DEFINITION];
