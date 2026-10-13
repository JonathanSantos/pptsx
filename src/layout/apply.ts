import { Edge, Gutter, type Node as YogaNode } from 'yoga-layout';
import type { Edges } from '../core/defaults.ts';
import type { YogaStyle } from './style.ts';

type Applier<K extends keyof YogaStyle> = (node: YogaNode, value: NonNullable<YogaStyle[K]>) => void;

const EDGES: Readonly<Record<keyof Edges, Edge>> = {
  top: Edge.Top,
  right: Edge.Right,
  bottom: Edge.Bottom,
  left: Edge.Left,
};

const edgeEntries = <V>(values: Partial<Record<keyof Edges, V>>) =>
  (Object.keys(values) as (keyof Edges)[]).flatMap((key) => {
    const value = values[key];
    return value === undefined ? [] : [[EDGES[key], value] as const];
  });

const APPLIERS: { readonly [K in keyof YogaStyle]-?: Applier<K> } = {
  flexDirection: (node, value) => node.setFlexDirection(value),
  gap: (node, value) => node.setGap(Gutter.All, value),
  padding: (node, value) => edgeEntries(value).forEach(([edge, v]) => node.setPadding(edge, v)),
  alignItems: (node, value) => node.setAlignItems(value),
  justifyContent: (node, value) => node.setJustifyContent(value),
  flexGrow: (node, value) => node.setFlexGrow(value),
  flexShrink: (node, value) => node.setFlexShrink(value),
  flexBasis: (node, value) => node.setFlexBasis(value),
  width: (node, value) => node.setWidth(value),
  height: (node, value) => node.setHeight(value),
  minWidth: (node, value) => node.setMinWidth(value),
  maxWidth: (node, value) => node.setMaxWidth(value),
  minHeight: (node, value) => node.setMinHeight(value),
  maxHeight: (node, value) => node.setMaxHeight(value),
  alignSelf: (node, value) => node.setAlignSelf(value),
  positionType: (node, value) => node.setPositionType(value),
  position: (node, value) => edgeEntries(value).forEach(([edge, v]) => node.setPosition(edge, v)),
  aspectRatio: (node, value) => node.setAspectRatio(value),
};

const applyKey = <K extends keyof YogaStyle>(node: YogaNode, style: YogaStyle, key: K): void => {
  const value = style[key];
  if (value === undefined) return;
  // TS não correlaciona a chave com a entrada da tabela; o tipo da tabela garante a coerência.
  const applier = APPLIERS[key] as Applier<K>;
  applier(node, value as NonNullable<YogaStyle[K]>);
};

/** Única função que muta o nó Yoga a partir da descrição. */
export const applyStyle = (node: YogaNode, style: YogaStyle): void => {
  (Object.keys(style) as (keyof YogaStyle)[]).forEach((key) => applyKey(node, style, key));
};
