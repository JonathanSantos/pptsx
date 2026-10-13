import { DEFAULTS } from '../core/defaults.ts';
import type { PositionedNode, PositionedSlide, PositionedText, Rect } from '../core/types.ts';
import { containerExcessOf, contentOf, excessOf, isBox, isInFlow } from './geometry.ts';
import type { Container } from './geometry.ts';
import { isWithin } from './scope.ts';

export interface Overflow {
  readonly kind: 'text' | 'box' | 'slide';
  readonly path: string;
  readonly overflowPt: number;
  readonly overflowPct: number;
}

const EPSILON = DEFAULTS.fit.epsilon;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const percentOf = (excess: number, base: number): number => (base > 0 ? (excess / base) * 100 : 100);

const isText = (node: PositionedNode): node is PositionedText => node.kind === 'text';

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

const flowContainersOf = (container: Container): readonly Container[] => [
  container,
  ...container.children.filter(isInFlow).filter(isBox).flatMap(flowContainersOf),
];

/**
 * box: filhos em fluxo que passam da área de conteúdo do contêiner. Um Text que já
 * estourou não conta para o contêiner (a causa já foi reportada nele).
 */
const boxOverflow = (container: Container, explained: ReadonlySet<string>): Overflow | undefined => {
  const excess = containerExcessOf(container, explained);
  if (excess.pt <= EPSILON) return undefined;
  return { kind: 'box', path: container.path, overflowPt: excess.pt, overflowPct: percentOf(excess.pt, excess.available) };
};

const isInsideAny = (path: string, ancestors: readonly string[]): boolean =>
  ancestors.some((ancestor) => ancestor !== path && isWithin(path, ancestor));

/**
 * slide: só o nó em fluxo mais externo que sai do slide, e só quando nenhum Box
 * ancestral já reportou box-overflow — aí a causa é o contêiner e um segundo erro
 * só duplica.
 */
const slideOverflows = (children: readonly PositionedNode[], bounds: Rect, boxes: readonly string[]): readonly Overflow[] =>
  children.filter(isInFlow).flatMap((child) => {
    const excess = excessOf(child.frame, bounds);
    if (excess.pt <= EPSILON) return isBox(child) ? slideOverflows(child.children, bounds, boxes) : [];
    if (isInsideAny(child.path, boxes)) return [];
    return [{ kind: 'slide' as const, path: child.path, overflowPt: excess.pt, overflowPct: percentOf(excess.pt, child.frame[excess.axis]) }];
  });

/**
 * Pura: lista os estouros do slide posicionado. Absolutos e descendentes nunca geram box/slide.
 * Regras contra duplicata, nesta ordem:
 *  1. text estourado não conta para o box do pai;
 *  2. nó fora do slide dentro de um Box com box-overflow não gera slide (a causa é o Box);
 *  3. no próprio Slide, o que já saiu da página é reportado como slide, não como box do Slide
 *     (out-of-slide diz o lado; o box do Slide fica para o que só invade o padding).
 */
export const detectOverflow = (slide: PositionedSlide): readonly Overflow[] => {
  const texts = textOverflows(slide);
  const explained = new Set(texts.map((overflow) => overflow.path));
  const [, ...boxContainers] = flowContainersOf(slide);
  const boxes = boxContainers.map((container) => boxOverflow(container, explained)).filter(isDefined);
  const outside = slideOverflows(slide.children, slide.frame, boxes.map((overflow) => overflow.path));
  const slideBox = boxOverflow(slide, new Set([...explained, ...outside.map((overflow) => overflow.path)]));
  return [...texts, ...(slideBox === undefined ? [] : [slideBox]), ...boxes, ...outside];
};
