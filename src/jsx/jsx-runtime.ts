import { FRAGMENT } from '../core/types.ts';
import type { Child, ElementType, Primitive, SlideElement } from '../core/types.ts';

// Anotação explícita: sem ela o TS alarga o unique symbol para `symbol`.
export const Fragment: typeof FRAGMENT = FRAGMENT;

type ElementKey = string | number;

/** Só monta o elemento congelado; componentes são chamados apenas no resolve. */
export const jsx = (type: ElementType, props: object, key?: ElementKey): SlideElement => {
  const frozenProps = Object.freeze({ ...props }) as SlideElement['props'];
  const element: SlideElement = key === undefined ? { type, props: frozenProps } : { type, props: frozenProps, key };
  return Object.freeze(element);
};

/** O compilador usa jsxs quando há vários filhos estáticos; o resultado é idêntico. */
export const jsxs = jsx;

export declare namespace JSX {
  type Element = SlideElement;
  // Componentes podem devolver null, strings ou arrays (Child), não só elementos.
  type ElementType = Primitive<any> | ((props: any) => Child);
  interface ElementChildrenAttribute {
    children: {};
  }
  // key é consumida pelo compilador (3º argumento de jsx), não vira prop.
  interface IntrinsicAttributes {
    key?: ElementKey;
  }
  // Sem tags minúsculas: toda tag é uma primitiva ou componente.
  interface IntrinsicElements {}
}
