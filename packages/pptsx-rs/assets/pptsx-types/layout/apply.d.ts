import { Edge, type Node as YogaNode } from 'yoga-layout';
import type { Sides } from '../core/types.ts';
import type { YogaStyle } from './style.ts';
/** Única função que muta o nó Yoga a partir da descrição. */
export declare const applyStyle: (node: YogaNode, style: YogaStyle) => void;
export declare const readSides: (read: (edge: Edge) => number) => Sides<number>;
