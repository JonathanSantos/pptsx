import { Edge, Gutter, type Node as YogaNode } from 'yoga-layout';
import type { Side, Sides } from '../core/types.ts';
import type { YogaStyle } from './style.ts';

type Applier<K extends keyof YogaStyle> = (node: YogaNode, value: NonNullable<YogaStyle[K]>) => void;

const EDGES: Readonly<Record<Side, Edge>> = { top: Edge.Top, right: Edge.Right, bottom: Edge.Bottom, left: Edge.Left };

const edgeEntries = <V>(values: Partial<Sides<V>>) =>
  (Object.keys(values) as Side[]).flatMap((key) => {
    const value = values[key];
    return value === undefined ? [] : [[EDGES[key], value] as const];
  });

const APPLIERS: { readonly [K in keyof YogaStyle]-?: Applier<K> } = {
  flexDirection: (node, value) => node.setFlexDirection(value),
  flexWrap: (node, value) => node.setFlexWrap(value),
  justifyContent: (node, value) => node.setJustifyContent(value),
  alignItems: (node, value) => node.setAlignItems(value),
  alignContent: (node, value) => node.setAlignContent(value),
  alignSelf: (node, value) => node.setAlignSelf(value),
  rowGap: (node, value) => node.setGap(Gutter.Row, value),
  columnGap: (node, value) => node.setGap(Gutter.Column, value),
  padding: (node, value) => edgeEntries(value).forEach(([edge, v]) => node.setPadding(edge, v)),
  border: (node, value) => edgeEntries(value).forEach(([edge, v]) => node.setBorder(edge, v)),
  margin: (node, value) => edgeEntries(value).forEach(([edge, v]) => node.setMargin(edge, v)),
  flexGrow: (node, value) => node.setFlexGrow(value),
  flexShrink: (node, value) => node.setFlexShrink(value),
  flexBasis: (node, value) => node.setFlexBasis(value),
  width: (node, value) => node.setWidth(value),
  height: (node, value) => node.setHeight(value),
  minWidth: (node, value) => node.setMinWidth(value),
  maxWidth: (node, value) => node.setMaxWidth(value),
  minHeight: (node, value) => node.setMinHeight(value),
  maxHeight: (node, value) => node.setMaxHeight(value),
  positionType: (node, value) => node.setPositionType(value),
  position: (node, value) => edgeEntries(value).forEach(([edge, v]) => node.setPosition(edge, v)),
  aspectRatio: (node, value) => node.setAspectRatio(value),
};

const applyKey = <K extends keyof YogaStyle>(node: YogaNode, style: YogaStyle, key: K): void => {
  const value = style[key];
  if (value === undefined) return;
  // TS não correlaciona a chave com a entrada da tabela; o tipo da tabela garante a coerência.
  (APPLIERS[key] as Applier<K>)(node, value as NonNullable<YogaStyle[K]>);
};

/** Única função que muta o nó Yoga a partir da descrição. */
export const applyStyle = (node: YogaNode, style: YogaStyle): void => {
  (Object.keys(style) as (keyof YogaStyle)[]).forEach((key) => applyKey(node, style, key));
};

export const readSides = (read: (edge: Edge) => number): Sides<number> => ({
  top: read(Edge.Top),
  right: read(Edge.Right),
  bottom: read(Edge.Bottom),
  left: read(Edge.Left),
});
