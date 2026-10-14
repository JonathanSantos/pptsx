import type { ResolvedNode, ResolvedSlide, TextProps } from '../core/types.ts';

/** O que o ajuste pode mudar num Text da árvore resolvida (numa Table, só `size`). */
export type TextPatch = Readonly<Pick<TextProps, 'size' | 'maxLines'>>;

export type TextPatches = ReadonlyMap<string, TextPatch>;

const patchNode = (node: ResolvedNode, patches: TextPatches): ResolvedNode => {
  if (node.kind === 'box') return { ...node, children: node.children.map((child) => patchNode(child, patches)) };
  if (node.kind !== 'text' && node.kind !== 'table') return node;
  const patch = patches.get(node.path);
  if (patch === undefined) return node;
  // Tabela não trunca: maxLines não existe nela (e não pode vazar para as props).
  if (node.kind === 'table') return patch.size === undefined ? node : { ...node, props: { ...node.props, size: patch.size } };
  return { ...node, props: { ...node.props, ...patch } };
};

/** Cópia da árvore resolvida com os patches aplicados por path (a original não muda). */
export const patchTexts = (slide: ResolvedSlide, patches: TextPatches): ResolvedSlide =>
  patches.size === 0 ? slide : { ...slide, children: slide.children.map((child) => patchNode(child, patches)) };
