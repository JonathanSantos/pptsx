import { DEFAULTS } from '../core/defaults.ts';
import type { PositionedNode, PositionedSlide, PositionedTable, PositionedText, Rect } from '../core/types.ts';
import { containerExcessOf, contentOf, excessOf, isBox, isInFlow, marginBoxOf } from './geometry.ts';
import type { Container } from './geometry.ts';
import { isWithin } from './scope.ts';

export interface Overflow {
  readonly kind: 'text' | 'table' | 'box' | 'slide';
  readonly path: string;
  readonly overflowPt: number;
  readonly overflowPct: number;
  /** M8: só Text com nowrap estoura em 'width'; ausente = altura. */
  readonly axis?: 'width' | 'height';
  /** M11: box-overflow de um item de grid que passa da própria célula (a área é a célula). */
  readonly cell?: boolean;
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
// M11: a área do texto é a de conteúdo do próprio nó (frame − borda − padding), cortada pela
// célula quando é item de grid, senão pela área de conteúdo do pai.
const clipOf = (node: PositionedNode, parent: Container): Rect => node.cell ?? contentOf(parent);

const availableHeightOf = (node: PositionedText | PositionedTable, parent: Container): number => {
  const area = contentOf(node);
  if (!isInFlow(node)) return area.height;
  const clip = clipOf(node, parent);
  const bottom = Math.min(area.y + area.height, clip.y + clip.height);
  return Math.max(0, bottom - area.y);
};

// text: com shrink 1 o Yoga espreme a caixa e o estouro aparece no próprio Text.
// Vale também para Text absoluto: texto maior que a própria caixa é sempre um problema.
const textOverflow = (node: PositionedText, parent: Container): Overflow | undefined => {
  const available = availableHeightOf(node, parent);
  const excess = node.text.height - available;
  if (excess <= EPSILON) return undefined;
  return { kind: 'text', path: node.path, overflowPt: excess, overflowPct: percentOf(excess, available) };
};

// A tabela pede Σ rowHeights (já arredondadas pelo layout como o emissor grava); o frame do
// Yoga pode ser menor quando o pai a espreme. Sem estouro de largura: a tabela ocupa a largura que recebeu.
const tableOverflow = (node: PositionedTable, parent: Container): Overflow | undefined => {
  const available = availableHeightOf(node, parent);
  const excess = node.height - available;
  if (excess <= EPSILON) return undefined;
  return { kind: 'table', path: node.path, overflowPt: excess, overflowPct: percentOf(excess, available) };
};

/** Largura disponível: o frame cortado pela área de conteúdo do pai (em fluxo), como na altura. */
const availableWidthOf = (node: PositionedText, parent: Container): number => {
  const area = contentOf(node);
  if (!isInFlow(node)) return area.width;
  const clip = clipOf(node, parent);
  const right = Math.min(area.x + area.width, clip.x + clip.width);
  return Math.max(0, right - area.x);
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

/**
 * M11: item de grid (que não é Text/Table) cuja caixa de margem passa da célula: o track é
 * fixo/fr e não cresceu com ele. Vira box-overflow no item, com a célula como área. Se o item
 * já estourou por dentro, o estouro de dentro é o que vale (não duplica no mesmo path).
 */
const cellOverflows = (container: Container, already: ReadonlySet<string>): readonly Overflow[] =>
  container.children.filter(isInFlow).flatMap((child): readonly Overflow[] => {
    const nested = isBox(child) ? cellOverflows(child, already) : [];
    if (child.cell === undefined || isText(child) || isTable(child) || already.has(child.path)) return nested;
    const excess = excessOf(marginBoxOf(child), child.cell);
    if (excess.pt <= EPSILON) return nested;
    const overflow: Overflow = { kind: 'box', cell: true, path: child.path, overflowPt: excess.pt, overflowPct: percentOf(excess.pt, child.cell[excess.axis]) };
    return [overflow, ...nested];
  });

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
  const [, ...boxContainers] = flowContainersOf(slide);
  // M11: estouro de célula conta como explicado para o grid (a causa é o item, como no Text).
  const inner = boxContainers.map((container) => boxOverflow(container, new Set(leaves.map((overflow) => overflow.path)))).filter(isDefined);
  const cells = cellOverflows(slide, new Set(inner.map((overflow) => overflow.path)));
  const explained = new Set([...leaves, ...cells].map((overflow) => overflow.path));
  const boxes = [...boxContainers.map((container) => boxOverflow(container, explained)).filter(isDefined), ...cells];
  const wide = new Set(leaves.filter(isWidthOverflow).map((overflow) => overflow.path));
  const outside = slideOverflows(slide.children, slide.frame, boxes.map((overflow) => overflow.path), wide);
  const slideBox = boxOverflow(slide, new Set([...explained, ...outside.map((overflow) => overflow.path)]));
  return [...leaves, ...(slideBox === undefined ? [] : [slideBox]), ...boxes, ...outside];
};
