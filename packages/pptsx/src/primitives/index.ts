import { COMPONENT_META, LAYOUT_DEFINITION, PRIMITIVE_KIND } from '../core/types.ts';
import type { AuthorPropsMap, Child, Component, ComponentMeta, ComponentMetaFor, LayoutComponent, LayoutOptions, Primitive, PrimitiveKind, SlideElement } from '../core/types.ts';
import { jsx } from '../jsx/jsx-runtime.ts';

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** Factory: função marcada com o kind; chamá-la direto equivale a usar a tag. */
export const definePrimitive = <K extends PrimitiveKind>(kind: K): Primitive<K> => {
  const primitive = (props: AuthorPropsMap[K]) => jsx(primitive as Primitive<K>, props);
  Object.defineProperty(primitive, 'name', { value: capitalize(kind) });
  Object.defineProperty(primitive, PRIMITIVE_KIND, { value: kind, enumerable: false });
  return Object.freeze(primitive) as Primitive<K>;
};

export const isPrimitive = (type: unknown): type is Primitive<PrimitiveKind> =>
  typeof type === 'function' && PRIMITIVE_KIND in type;

export const primitiveName = (kind: PrimitiveKind): string => capitalize(kind);

export const Deck = definePrimitive('deck');
export const Slide = definePrimitive('slide');
export const Box = definePrimitive('box');
export const Text = definePrimitive('text');
export const Image = definePrimitive('image');
export const Shape = definePrimitive('shape');
export const Span = definePrimitive('span');
export const Chart = definePrimitive('chart');
export const Table = definePrimitive('table');
export const Path = definePrimitive('path');
export const Icon = definePrimitive('icon');
export const Connector = definePrimitive('connector');
export const SlideNumber = definePrimitive('slideNumber');

// Componentes (não primitivas): props do autor vêm depois, então vencem o padrão.
export function B(props: AuthorPropsMap['span']): SlideElement {
  return jsx(Span, { weight: 'bold', ...props });
}

export function I(props: AuthorPropsMap['span']): SlideElement {
  return jsx(Span, { italic: true, ...props });
}

/** M13: sobrescrito (m², nota¹). */
export function Sup(props: AuthorPropsMap['span']): SlideElement {
  return jsx(Span, { verticalAlign: 'super', ...props });
}

/** M13: subscrito (H₂O). */
export function Sub(props: AuthorPropsMap['span']): SlideElement {
  return jsx(Span, { verticalAlign: 'sub', ...props });
}

/**
 * M15: marca um componente que devolve um <Slide> como layout do arquivo: os slides que ele gera
 * usam um slide layout próprio no master (nome = `name`), com os placeholders nas posições do
 * primeiro uso e o conteúdo `fixed` no master. O componente continua sendo chamado como antes.
 */
export const defineLayout = <P>(name: string, options: LayoutOptions, component: Component<P>): LayoutComponent<P> => {
  const layout = (props: P) => component(props);
  Object.defineProperty(layout, 'name', { value: name });
  Object.defineProperty(layout, LAYOUT_DEFINITION, { value: Object.freeze({ name, ...options }), enumerable: false });
  return Object.freeze(layout) as LayoutComponent<P>;
};

/**
 * M17: componente com identidade. O nome (`displayName ?? name`) vai no path mesmo quando a função é
 * anônima ou embrulhada; `defaults` preenche as props ausentes; o `meta` (livre: `ds`, `tags`, `catalog`…)
 * chega ao nó resolvido em `component`, onde regras de lint e o catálogo o leem. Sem variantes nem estilo:
 * isso é do DS. Função comum continua valendo como componente.
 */
export function defineComponent<P extends object>(meta: string | ComponentMetaFor<NoInfer<P>>, fn: (props: P) => Child, defaults?: Partial<NoInfer<P>>): Component<P> {
  const base: ComponentMeta = typeof meta === 'string' ? { name: meta } : { ...meta };
  // Os padrões ficam no meta (só leitura): o catálogo e o schema automático de um DS os mostram.
  const identity: ComponentMeta = Object.freeze(defaults === undefined ? base : { ...base, defaults });
  if (typeof identity.name !== 'string' || identity.name.trim() === '') throw new Error('defineComponent: o nome do componente não pode ser vazio');
  const component = (props: P): Child => fn(defaults === undefined ? props : ({ ...defaults, ...props } as P));
  Object.defineProperty(component, 'name', { value: identity.displayName ?? identity.name });
  Object.defineProperty(component, COMPONENT_META, { value: identity, enumerable: false });
  return Object.freeze(component) as Component<P>;
}
