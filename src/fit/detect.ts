import { DEFAULTS } from '../core/defaults.ts';
import type { PositionedNode, PositionedSlide, PositionedTable, PositionedText, Rect } from '../core/types.ts';
import { containerExcessOf, contentOf, excessOf, isBox, isInFlow } from './geometry.ts';
import type { Container } from './geometry.ts';
import { isWithin } from './scope.ts';

export interface Overflow {
  readonly kind: 'text' | 'table' | 'box' | 'slide';
  readonly path: string;
  readonly overflowPt: number;
  readonly overflowPct: number;
  /** M8: só Text com nowrap estoura em 'width'; ausente = altura. */
  readonly axis?: 'width' | 'height';
}

const EPSILON = DEFAULTS.fit.epsilon;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const percentOf = (excess: number, base: number): number => (base > 0 ? (excess / base) * 100 : 100);

const isText = (node: PositionedNode): node is PositionedText => node.kind === 'text';
const isTable = (node: PositionedNode): node is PositionedTable => node.kind === 'table';

/**
 * Altura disponível para o Text (ou a Table): o próprio frame, cortado pela área de
 * conteúdo do pai quando está em fluxo. Numa row espremida pela coluna de fora, o Text
 * fica no eixo cruzado com a altura medida e quem encolhe é a row — o estouro é do texto.
 */
const availableHeightOf = (node: PositionedText | PositionedTable, parent: Container): number => {
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

// A tabela pede Σ rowHeights; o frame do Yoga pode ser menor quando o pai a espreme.
// Sem estouro de largura: a tabela ocupa a largura que recebeu.
const tableOverflow = (node: PositionedTable, parent: Container): Overflow | undefined => {
  const available = availableHeightOf(node, parent);
  const excess = node.height - available;
  if (excess <= EPSILON) return undefined;
  return { kind: 'table', path: node.path, overflowPt: excess, overflowPct: percentOf(excess, available) };
};

/** Largura disponível: o frame cortado pela área de conteúdo do pai (em fluxo), como na altura. */
const availableWidthOf = (node: PositionedText, parent: Container): number => {
  if (!isInFlow(node)) return node.frame.width;
  const content = contentOf(parent);
  const right = Math.min(node.frame.x + node.frame.width, content.x + content.width);
  return Math.max(0, right - node.frame.x);
};

// nowrap: a linha não quebra, então o que não cabe sai pela lateral. Numa row o minWidth
// alarga o frame até a linha; o corte pela área do pai é o que revela o estouro ali.
const widthOverflow = (node: PositionedText, parent: Container): Overflow | undefined => {
  if (node.props.nowrap !== true) return undefined;
  const available = availableWidthOf(node, parent);
  const excess = node.text.width - available;
  if (excess <= EPSILON) return undefined;
  return { kind: 'text', axis: 'width', path: node.path, overflowPt: excess, overflowPct: percentOf(excess, available) };
};

const leafOverflows = (container: Container): readonly Overflow[] =>
  container.children.flatMap((child) => {
    if (isBox(child)) return leafOverflows(child);
    if (isTable(child)) return [tableOverflow(child, container)].filter(isDefined);
    return isText(child) ? [textOverflow(child, container), widthOverflow(child, container)].filter(isDefined) : [];
  });

export const isWidthOverflow = (overflow: Overflow): boolean => overflow.axis === 'width';

const flowContainersOf = (container: Container): readonly Container[] => [
  container,
  ...container.children.filter(isInFlow).filter(isBox).flatMap(flowContainersOf),
];

/**
 * box: filhos em fluxo que passam da área de conteúdo do contêiner. Um Text (ou Table)
 * que já estourou não conta para o contêiner (a causa já foi reportada nele).
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
const slideOverflows = (
  children: readonly PositionedNode[],
  bounds: Rect,
  boxes: readonly string[],
  wide: ReadonlySet<string>,
): readonly Overflow[] =>
  children.filter(isInFlow).flatMap((child) => {
    const excess = excessOf(child.frame, bounds);
    if (excess.pt <= EPSILON) return isBox(child) ? slideOverflows(child.children, bounds, boxes, wide) : [];
    if (isInsideAny(child.path, boxes) || wide.has(child.path)) return [];
    return [{ kind: 'slide' as const, path: child.path, overflowPt: excess.pt, overflowPct: percentOf(excess.pt, child.frame[excess.axis]) }];
  });

/**
 * Pura: lista os estouros do slide posicionado. Absolutos e descendentes nunca geram box/slide.
 * Regras contra duplicata, nesta ordem:
 *  1. text/table estourado não conta para o box do pai;
 *  2. nó fora do slide dentro de um Box com box-overflow não gera slide (a causa é o Box);
 *  3. Text nowrap com estouro de largura não gera slide (o frame alargado é o próprio estouro);
 *  4. no próprio Slide, o que já saiu da página é reportado como slide, não como box do Slide
 *     (out-of-slide diz o lado; o box do Slide fica para o que só invade o padding).
 */
export const detectOverflow = (slide: PositionedSlide): readonly Overflow[] => {
  const leaves = leafOverflows(slide);
  const explained = new Set(leaves.map((overflow) => overflow.path));
  const [, ...boxContainers] = flowContainersOf(slide);
  const boxes = boxContainers.map((container) => boxOverflow(container, explained)).filter(isDefined);
  const wide = new Set(leaves.filter(isWidthOverflow).map((overflow) => overflow.path));
  const outside = slideOverflows(slide.children, slide.frame, boxes.map((overflow) => overflow.path), wide);
  const slideBox = boxOverflow(slide, new Set([...explained, ...outside.map((overflow) => overflow.path)]));
  return [...leaves, ...(slideBox === undefined ? [] : [slideBox]), ...boxes, ...outside];
};
