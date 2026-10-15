import { flexDirectionOf } from '../core/defaults.ts';
import { contentRectOf } from '../layout/index.ts';
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

export const isInFlow = (node: PositionedNode): boolean => node.css.position !== 'absolute';

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

// M11: área de conteúdo = frame − borda − padding (resolvidos pelo layout, % inclusive).
export const contentOf = (node: Container | PositionedNode): Rect => contentRectOf(node.frame, node.box);

/** M11: caixa de margem (frame + margens); é o que o filho ocupa no contêiner. */
export const marginBoxOf = (node: PositionedNode): Rect => {
  const { margin } = node.box;
  return {
    x: node.frame.x - margin.left,
    y: node.frame.y - margin.top,
    width: node.frame.width + margin.left + margin.right,
    height: node.frame.height + margin.top + margin.bottom,
  };
};

/** M11: soma das margens verticais (a demanda de altura de um filho inclui as dele). */
export const verticalMarginOf = (node: PositionedNode): number => node.box.margin.top + node.box.margin.bottom;

export interface ContainerExcess extends Excess {
  /** Tamanho da área de conteúdo no eixo do estouro. */
  readonly available: number;
  readonly direction: FlexDirection;
  /** M11: grade ou flex com wrap (as linhas se empilham; a mensagem fala delas). */
  readonly layout?: 'grid' | 'wrap';
}

const layoutOf = (container: Container): ContainerExcess['layout'] => {
  if (container.css.display === 'grid') return 'grid';
  return container.css.display === 'flex' && container.css.flexWrap !== 'nowrap' ? 'wrap' : undefined;
};

/** Estouro dos filhos em fluxo sobre a área de conteúdo, ignorando os já explicados. */
export const containerExcessOf = (container: Container, explained: ReadonlySet<string>): ContainerExcess => {
  const content = contentOf(container);
  const excess = largest(
    container.children
      .filter(isInFlow)
      .filter((child) => !explained.has(child.path))
      // M11: o filho ocupa a caixa de margem (CSS: margens contam no overflow do contêiner).
      .map((child) => excessOf(marginBoxOf(child), content)),
  );
  const layout = layoutOf(container);
  return { ...excess, available: content[excess.axis], direction: flexDirectionOf(container.css), ...(layout === undefined ? {} : { layout }) };
};
