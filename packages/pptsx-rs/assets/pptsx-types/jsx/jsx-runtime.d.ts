import { FRAGMENT } from '../core/types.ts';
import type { Child, ElementType, Primitive, SlideElement } from '../core/types.ts';
export declare const Fragment: typeof FRAGMENT;
type ElementKey = string | number;
/** Só monta o elemento congelado; componentes são chamados apenas no resolve. */
export declare const jsx: (type: ElementType, props: object, key?: ElementKey) => SlideElement;
/** O compilador usa jsxs quando há vários filhos estáticos; o resultado é idêntico. */
export declare const jsxs: typeof jsx;
export declare namespace JSX {
    type Element = SlideElement;
    type ElementType = Primitive<any> | ((props: any) => Child);
    interface ElementChildrenAttribute {
        children: {};
    }
    interface IntrinsicAttributes {
        key?: ElementKey;
    }
    interface IntrinsicElements {
    }
}
export {};
