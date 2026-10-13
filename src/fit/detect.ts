import { DEFAULTS, containerOf } from '../core/defaults.ts';
import type { PositionedBox, PositionedNode, PositionedSlide, PositionedText, Rect } from '../core/types.ts';

export interface Overflow {
  readonly kind: 'text' | 'box' | 'slide';
  readonly path: string;
  readonly overflowPt: number;
  readonly overflowPct: number;
}

type Container = PositionedSlide | PositionedBox;

const EPSILON = DEFAULTS.fit.epsilon;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const percentOf = (excess: number, base: number): number => (base > 0 ? (excess / base) * 100 : 100);

const isInFlow = (node: PositionedNode): boolean => node.props.position !== 'absolute';

const isBox = (node: PositionedNode): node is PositionedBox => node.kind === 'box';

const isText = (node: PositionedNode): node is PositionedText => node.kind === 'text';

interface Excess {
  readonly pt: number;
  readonly axis: 'width' | 'height';
}

/** Quanto `inner` passa de `outer`, no eixo em que passa mais. */
const excessOf = (inner: Rect, outer: Rect): Excess => {
  const vertical = Math.max(0, outer.y - inner.y, inner.y + inner.height - (outer.y + outer.height));
  const horizontal = Math.max(0, outer.x - inner.x, inner.x + inner.width - (outer.x + outer.width));
  return vertical >= horizontal ? { pt: vertical, axis: 'height' } : { pt: horizontal, axis: 'width' };
};

const largest = (excesses: readonly Excess[]): Excess =>
  excesses.reduce((max, excess) => (excess.pt > max.pt ? excess : max), { pt: 0, axis: 'height' });

const contentOf = (container: Container): Rect => {
  const { padding } = containerOf(container.props);
  const { x, y, width, height } = container.frame;
  return {
    x: x + padding.left,
    y: y + padding.top,
    width: Math.max(0, width - padding.left - padding.right),
    height: Math.max(0, height - padding.top - padding.bottom),
  };
};

/**
 * Altura disponível para o Text: o próprio frame, cortado pela área de conteúdo do
 * pai quando está em fluxo. Numa row espremida pela coluna de fora, o Text fica no
 * eixo cruzado com a altura medida e quem encolhe é a row — o estouro é do texto.
 */
const availableHeightOf = (node: PositionedText, parent: Container): number => {
  if (!isInFlow(node)) return node.frame.height;
  const content = contentOf(parent);
  const bottom = Math.min(node.frame.y + node.frame.height, content.y + content.height);
  return Math.max(0, bottom - node.frame.y);
};

// text: com shrink 1 o Yoga espreme a caixa e o estouro aparece no próprio Text.
// Vale também para Text absoluto: texto maior que a própria caixa é sempre um problema.
const textOverflow = (node: PositionedText, parent: Container): Overflow | undefined => {
  const available = availableHeightOf(node, parent);
  const excess = node.text.height - available;
  if (excess <= EPSILON) return undefined;
  return { kind: 'text', path: node.path, overflowPt: excess, overflowPct: percentOf(excess, available) };
};

const textOverflows = (container: Container): readonly Overflow[] =>
  container.children.flatMap((child) => {
    if (isBox(child)) return textOverflows(child);
    return isText(child) ? [textOverflow(child, container)].filter(isDefined) : [];
  });

// slide: só o nó em fluxo mais externo que sai do slide; descendentes saem junto e
// repetir o diagnóstico para cada um não ajuda quem vai corrigir.
const slideOverflows = (children: readonly PositionedNode[], bounds: Rect): readonly Overflow[] =>
  children.filter(isInFlow).flatMap((child) => {
    const excess = excessOf(child.frame, bounds);
    if (excess.pt > EPSILON) {
      return [{ kind: 'slide' as const, path: child.path, overflowPt: excess.pt, overflowPct: percentOf(excess.pt, child.frame[excess.axis]) }];
    }
    return isBox(child) ? slideOverflows(child.children, bounds) : [];
  });

const flowContainersOf = (container: Container): readonly Container[] => [
  container,
  ...container.children.filter(isInFlow).filter(isBox).flatMap(flowContainersOf),
];

/**
 * box: filhos em fluxo que passam da área de conteúdo do contêiner. Regra contra
 * duplicatas: um Text que já estourou não conta para o contêiner (a causa já foi
 * reportada nele). Um filho fora do slide conta: box e slide são fatos distintos
 * (o contêiner não comporta os filhos; o filho sai da página).
 */
const boxOverflow = (container: Container, explained: ReadonlySet<string>): Overflow | undefined => {
  const content = contentOf(container);
  const excess = largest(
    container.children
      .filter(isInFlow)
      .filter((child) => !explained.has(child.path))
      .map((child) => excessOf(child.frame, content)),
  );
  if (excess.pt <= EPSILON) return undefined;
  return { kind: 'box', path: container.path, overflowPt: excess.pt, overflowPct: percentOf(excess.pt, content[excess.axis]) };
};

/** Pura: lista os estouros do slide posicionado. Absolutos e descendentes nunca geram box/slide. */
export const detectOverflow = (slide: PositionedSlide): readonly Overflow[] => {
  const texts = textOverflows(slide);
  const outside = slideOverflows(slide.children, slide.frame);
  const explained = new Set(texts.map((overflow) => overflow.path));
  const boxes = flowContainersOf(slide).map((container) => boxOverflow(container, explained)).filter(isDefined);
  return [...texts, ...outside, ...boxes];
};
