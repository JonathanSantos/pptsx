import { PRIMITIVE_KIND } from '../core/types.ts';
import type { AuthorPropsMap, Primitive, PrimitiveKind, SlideElement } from '../core/types.ts';
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
