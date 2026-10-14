import type { Rect } from '../../src/core/types.ts';
import type { PositionedNode, PositionedSlide } from './types.ts';

/**
 * Ordem de pintura e transformações herdadas (puro; o emissor e o preview usam o mesmo).
 *
 * Regra (subconjunto do CSS 2.1 Apêndice E + CSS Flexbox §4.3):
 * - Itens de flex/grid pintam atomicamente, na ordem da árvore (como inline-blocks): é a
 *   ordem da engine hoje.
 * - Um nó "sobe de camada" quando é posicionado (relative/absolute), tem zIndex (item de
 *   flex/grid respeita z mesmo static), opacity < 1 ou transform. Ele pinta com a sua
 *   subárvore numa camada do contexto de empilhamento mais próximo: z negativo antes do
 *   fluxo, z 0/auto depois do fluxo (ordem da árvore), z positivo por último (z crescente,
 *   estável). Descendentes que sobem de camada dentro de um item atômico continuam no
 *   contexto de fora, como no browser.
 * - Simplificação: posicionado com z auto cria contexto próprio (z 0); no browser os
 *   posicionados dentro dele participariam do contexto de fora.
 */

export interface Rotation {
  readonly degrees: number;
  readonly cx: number;
  readonly cy: number;
}

export interface PaintItem {
  readonly node: PositionedNode;
  /** Opacidade efetiva (produto dos ancestrais e do próprio nó): o PPTX não tem opacidade de grupo. */
  readonly opacity: number;
  /** Rotações a aplicar, da mais externa (ancestral) à do próprio nó. */
  readonly rotations: readonly Rotation[];
  /** Índice do nó em pré-ordem da árvore (ids únicos no SVG). */
  readonly index: number;
}

interface Inherited {
  readonly opacity: number;
  readonly rotations: readonly Rotation[];
}

const centerOf = (frame: Rect): { readonly x: number; readonly y: number } => ({
  x: frame.x + frame.width / 2,
  y: frame.y + frame.height / 2,
});

const inheritedOf = (node: PositionedNode, parent: Inherited): Inherited => {
  const { rotate, opacity } = node.css;
  const own = rotate === 0 ? [] : [{ degrees: rotate, ...{ cx: centerOf(node.frame).x, cy: centerOf(node.frame).y } }];
  return { opacity: parent.opacity * opacity, rotations: [...parent.rotations, ...own] };
};

const hasTransform = (node: PositionedNode): boolean =>
  node.css.rotate !== 0 || node.css.translate.x !== 0 || node.css.translate.y !== 0;

/** Sobe de camada: posicionado, com z, translúcido ou transformado. */
const isLayered = (node: PositionedNode): boolean =>
  node.css.position !== 'static' || node.css.zIndex !== undefined || node.css.opacity < 1 || hasTransform(node);

interface Indexed {
  readonly node: PositionedNode;
  readonly inherited: Inherited;
  readonly index: number;
}

interface Collected {
  readonly flow: readonly Indexed[];
  readonly layers: readonly Indexed[];
}

const childrenOf = (node: PositionedNode): readonly PositionedNode[] => (node.kind === 'box' ? node.children : []);

/** Índices em pré-ordem, calculados uma vez para a árvore toda. */
const preorderIndex = (nodes: readonly PositionedNode[]): ReadonlyMap<PositionedNode, number> => {
  const order: PositionedNode[] = [];
  const visit = (node: PositionedNode): void => {
    order.push(node);
    childrenOf(node).forEach(visit);
  };
  nodes.forEach(visit);
  return new Map(order.map((node, index) => [node, index]));
};

/** Percorre o contexto: o fluxo em ordem da árvore; quem sobe de camada fica para depois, sem descer nele. */
const collect = (
  children: readonly PositionedNode[],
  inherited: Inherited,
  indexOf: ReadonlyMap<PositionedNode, number>,
): Collected =>
  children.reduce<Collected>(
    (acc, node) => {
      const own = inheritedOf(node, inherited);
      const item: Indexed = { node, inherited: own, index: indexOf.get(node) ?? 0 };
      if (isLayered(node)) return { ...acc, layers: [...acc.layers, item] };
      const nested = collect(childrenOf(node), own, indexOf);
      return { flow: [...acc.flow, item, ...nested.flow], layers: [...acc.layers, ...nested.layers] };
    },
    { flow: [], layers: [] },
  );

const zOf = (item: Indexed): number => item.node.css.zIndex ?? 0;

const toPaint = ({ node, inherited, index }: Indexed): PaintItem => ({
  node,
  opacity: inherited.opacity,
  rotations: inherited.rotations,
  index,
});

/** Um contexto de empilhamento: z < 0, fluxo, z 0, z > 0 (sort estável preserva a ordem da árvore). */
const paintContext = (
  children: readonly PositionedNode[],
  inherited: Inherited,
  indexOf: ReadonlyMap<PositionedNode, number>,
): readonly PaintItem[] => {
  const { flow, layers } = collect(children, inherited, indexOf);
  const sorted = [...layers].sort((a, b) => zOf(a) - zOf(b));
  const paintLayer = (item: Indexed): readonly PaintItem[] => [
    toPaint(item),
    ...paintContext(childrenOf(item.node), item.inherited, indexOf),
  ];
  return [
    ...sorted.filter((item) => zOf(item) < 0).flatMap(paintLayer),
    ...flow.map(toPaint),
    ...sorted.filter((item) => zOf(item) >= 0).flatMap(paintLayer),
  ];
};

export const paintOrderOf = (slide: PositionedSlide): readonly PaintItem[] =>
  paintContext(slide.children, { opacity: 1, rotations: [] }, preorderIndex(slide.children));

const rotatePoint = (point: { readonly x: number; readonly y: number }, rotation: Rotation) => {
  const radians = (rotation.degrees * Math.PI) / 180;
  const dx = point.x - rotation.cx;
  const dy = point.y - rotation.cy;
  return {
    x: rotation.cx + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: rotation.cy + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
};

export interface Placement {
  readonly frame: Rect;
  /** Graus, horário; 0 = sem rotação. */
  readonly rotate: number;
}

/**
 * O PPTX não tem grupo girado: cada forma recebe a soma das rotações e o centro levado pelas
 * rotações dos ancestrais (a mais interna primeiro). O tamanho não muda.
 */
export const placementOf = (frame: Rect, rotations: readonly Rotation[]): Placement => {
  if (rotations.length === 0) return { frame, rotate: 0 };
  const center = [...rotations].reverse().reduce(rotatePoint, centerOf(frame));
  const degrees = rotations.reduce((sum, rotation) => sum + rotation.degrees, 0);
  const normalized = ((degrees % 360) + 360) % 360;
  return {
    frame: { x: center.x - frame.width / 2, y: center.y - frame.height / 2, width: frame.width, height: frame.height },
    rotate: normalized,
  };
};
