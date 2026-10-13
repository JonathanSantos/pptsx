import { containerOf } from '../core/defaults.ts';
import type { FlexDirection, PositionedBox, PositionedNode, PositionedSlide, Rect } from '../core/types.ts';

// Geometria pura usada pela detecção e pelas mensagens (mesmas contas nos dois lugares).

export type Container = PositionedSlide | PositionedBox;
export type Axis = 'width' | 'height';
export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Excess {
  readonly pt: number;
  readonly axis: Axis;
}

export interface SideExcess {
  readonly side: Side;
  readonly pt: number;
}

export const isInFlow = (node: PositionedNode): boolean => node.props.position !== 'absolute';

export const isBox = (node: PositionedNode): node is PositionedBox => node.kind === 'box';

const AXIS_OF_SIDE: Readonly<Record<Side, Axis>> = { top: 'height', bottom: 'height', left: 'width', right: 'width' };

/** Quanto `inner` passa de `outer` em cada lado (só os lados que passam). */
export const sidesOutside = (inner: Rect, outer: Rect): readonly SideExcess[] =>
  (
    [
      { side: 'top', pt: outer.y - inner.y },
      { side: 'bottom', pt: inner.y + inner.height - (outer.y + outer.height) },
      { side: 'left', pt: outer.x - inner.x },
      { side: 'right', pt: inner.x + inner.width - (outer.x + outer.width) },
    ] as const
  ).filter((excess) => excess.pt > 0);

const NO_EXCESS: Excess = { pt: 0, axis: 'height' };

/** O maior estouro de `inner` em relação a `outer`, com o eixo em que acontece. */
export const excessOf = (inner: Rect, outer: Rect): Excess =>
  sidesOutside(inner, outer).reduce<Excess>(
    (max, { side, pt }) => (pt > max.pt ? { pt, axis: AXIS_OF_SIDE[side] } : max),
    NO_EXCESS,
  );

export const largest = (excesses: readonly Excess[]): Excess =>
  excesses.reduce((max, excess) => (excess.pt > max.pt ? excess : max), NO_EXCESS);

export const contentOf = (container: Container): Rect => {
  const { padding } = containerOf(container.props);
  const { x, y, width, height } = container.frame;
  return {
    x: x + padding.left,
    y: y + padding.top,
    width: Math.max(0, width - padding.left - padding.right),
    height: Math.max(0, height - padding.top - padding.bottom),
  };
};

export interface ContainerExcess extends Excess {
  /** Tamanho da área de conteúdo no eixo do estouro. */
  readonly available: number;
  readonly direction: FlexDirection;
}

/** Estouro dos filhos em fluxo sobre a área de conteúdo, ignorando os já explicados. */
export const containerExcessOf = (container: Container, explained: ReadonlySet<string>): ContainerExcess => {
  const content = contentOf(container);
  const excess = largest(
    container.children
      .filter(isInFlow)
      .filter((child) => !explained.has(child.path))
      .map((child) => excessOf(child.frame, content)),
  );
  return { ...excess, available: content[excess.axis], direction: containerOf(container.props).direction };
};
