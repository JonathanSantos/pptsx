// PoC CSS: cópia de src/fit/cause.ts com os tipos da PoC (nós com css); adaptações marcadas com 'PoC:'.
import { DEFAULTS, containerOf } from '../../../src/core/defaults.ts';
import type { Diagnostic, DiagnosticCode, PositionedNode, PositionedSlide, Pt } from '../types.ts';
import { isWidthOverflow } from './detect.ts';
import type { Overflow } from './detect.ts';
import { withCause, withWidthCause } from './diagnostics.ts';
import { contentOf, isBox, isInFlow } from './geometry.ts';
import type { Container } from './geometry.ts';
import { ancestorsOf, isWithin } from './scope.ts';
import { isTableFontMissing } from './shrinkable.ts';

// Causa de um estouro: num contêiner apertado, quem pede mais espaço do que recebeu
// é a causa; os outros estouros ali dentro são consequência. Sem isso o autor corrige
// o título espremido em vez do parágrafo gigante que tomou a altura.

export interface Cause {
  readonly path: string;
  /** Quanto (pt) a causa quer a mais do que a área deu. */
  readonly demand: Pt;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const childDemands = (container: Container): readonly number[] =>
  container.children.filter(isInFlow).map(demandOf);

const isRow = (container: Container): boolean => containerOf(container.props).direction === 'row';

/** Em coluna os filhos disputam a mesma altura (soma); numa row ficam lado a lado (o maior). */
const boxDemandOf = (container: Container): Pt => {
  const demands = childDemands(container);
  return isRow(container) ? Math.max(0, ...demands) : sum(demands);
};

/**
 * Imagem, Shape e Chart têm tamanho próprio: não pedem altura além da que receberam. Height
 * fixo do autor também não: não é espremido nem toma altura dos irmãos, então o estouro
 * dentro dele é problema próprio. Fonte ausente tem medição estimada: não acusa ninguém.
 * Table pede como o Text: o que as linhas somam além do frame.
 */
const demandOf = (node: PositionedNode): Pt => {
  if (node.props.height !== undefined) return 0;
  if (node.kind === 'text') return node.text.fontMissing ? 0 : Math.max(0, node.text.height - node.frame.height);
  if (node.kind === 'table') return isTableFontMissing(node) ? 0 : Math.max(0, node.height - node.frame.height);
  if (node.kind === 'box') return boxDemandOf(node);
  return 0;
};

/**
 * Só há disputa de altura quando o que os filhos ocupam mais o que pedem a mais não cabe
 * na área de conteúdo. Senão cada estouro é interno ao filho e ninguém é causa de ninguém.
 */
const isOverloaded = (container: Container): boolean => {
  const children = container.children.filter(isInFlow);
  const wanted = sum(children.map((child) => child.frame.height + demandOf(child)));
  const gaps = containerOf(container.props).gap * Math.max(0, children.length - 1);
  return wanted + gaps > contentOf(container).height + DEFAULTS.fit.epsilon;
};

/** Filho em fluxo de maior demanda (> 0); empate fica com o primeiro. */
const causeOf = (container: Container): Cause | undefined =>
  container.children.filter(isInFlow).reduce<Cause | undefined>((best, child) => {
    const demand = demandOf(child);
    if (demand <= 0 || (best !== undefined && demand <= best.demand)) return best;
    return { path: child.path, demand };
  }, undefined);

const flowContainersOf = (container: Container): readonly Container[] => [
  container,
  ...container.children.filter(isInFlow).filter(isBox).flatMap(flowContainersOf),
];

const isStrictlyWithin = (path: string, ancestor: string): boolean => path !== ancestor && isWithin(path, ancestor);

/**
 * Causa de cada contêiner em fluxo que tem algum estouro text/box entre os descendentes.
 * Row não aponta causa: filhos lado a lado não tiram altura uns dos outros (por isso a
 * demanda dela é a maior, não a soma). Sem essa exceção, N cartões iguais numa row
 * culpariam o primeiro cartão pelo estouro dos outros.
 */
export const causesOf = (slide: PositionedSlide, overflows: readonly Overflow[]): ReadonlyMap<string, Cause> => {
  // A demanda é só de altura: estouro de largura (nowrap) não disputa espaço com os irmãos.
  const overflowing = overflows
    .filter((overflow) => overflow.kind !== 'slide' && !isWidthOverflow(overflow))
    .map((overflow) => overflow.path);
  return new Map(
    flowContainersOf(slide).flatMap((container) => {
      if (isRow(container) || !overflowing.some((path) => isStrictlyWithin(path, container.path))) return [];
      if (!isOverloaded(container)) return [];
      const cause = causeOf(container);
      return cause === undefined ? [] : [[container.path, cause] as const];
    }),
  );
};

const ATTRIBUTABLE: ReadonlySet<DiagnosticCode> = new Set(['text-overflow', 'table-overflow', 'box-overflow']);

/**
 * O contêiner mais próximo cuja causa é outro nó decide. Onde o próprio nó é a causa
 * (ou está dentro dela), sobe: o cartão cujo texto estoura pode estar espremido por um
 * parágrafo lá fora, e é esse parágrafo que o autor precisa corrigir.
 */
const attribute =
  (causes: ReadonlyMap<string, Cause>) =>
  (diagnostic: Diagnostic): Diagnostic => {
    if (!ATTRIBUTABLE.has(diagnostic.code) || diagnostic.data?.axis === 'width') return diagnostic;
    const nearest = ancestorsOf(diagnostic.path)
      .map((ancestor) => causes.get(ancestor))
      .find((cause) => cause !== undefined && !isWithin(diagnostic.path, cause.path));
    return nearest === undefined ? diagnostic : withCause(diagnostic, nearest);
  };

/**
 * Causa por largura: numa row, um Text nowrap que passa da largura toma o espaço dos
 * irmãos (o minWidth dele espreme os outros até 0 pt e os empurra para fora). Os estouros
 * dos irmãos e o box-overflow da row são consequência; vence o nowrap de maior estouro.
 */
export interface WidthCause {
  readonly path: string;
  readonly overflowPt: Pt;
  /** Irmãos em fluxo (sem a causa): os estouros dentro deles são consequência. */
  readonly siblings: readonly string[];
}

const widthCauseOf = (row: Container, widths: ReadonlyMap<string, Overflow>): WidthCause | undefined => {
  const inFlow = row.children.filter(isInFlow);
  const worst = inFlow.reduce<Overflow | undefined>((best, child) => {
    const overflow = widths.get(child.path);
    if (overflow === undefined || (best !== undefined && overflow.overflowPt <= best.overflowPt)) return best;
    return overflow;
  }, undefined);
  if (worst === undefined) return undefined;
  const siblings = inFlow.map((child) => child.path).filter((path) => path !== worst.path);
  return { path: worst.path, overflowPt: worst.overflowPt, siblings };
};

export const widthCausesOf = (slide: PositionedSlide, overflows: readonly Overflow[]): ReadonlyMap<string, WidthCause> => {
  const widths = new Map(overflows.filter(isWidthOverflow).map((overflow) => [overflow.path, overflow]));
  if (widths.size === 0) return new Map();
  return new Map(
    flowContainersOf(slide).flatMap((container) => {
      if (!isRow(container)) return [];
      const cause = widthCauseOf(container, widths);
      return cause === undefined ? [] : [[container.path, cause] as const];
    }),
  );
};

// Só nesta passada: palavra partida e nó fora do slide também são sintomas de irmão espremido.
const WIDTH_ATTRIBUTABLE: ReadonlySet<DiagnosticCode> = new Set([
  'text-overflow',
  'table-overflow',
  'text-word-broken',
  'box-overflow',
  'out-of-slide',
]);

/** A própria row (box-overflow dela) ou algo dentro de um irmão em fluxo do nowrap. */
const isConsequenceOf = (path: string, row: string, cause: WidthCause): boolean =>
  path === row || cause.siblings.some((sibling) => isWithin(path, sibling));

/** Depois da altura: quem já tem causedBy por altura mantém o que tem. */
const attributeWidth =
  (causes: ReadonlyMap<string, WidthCause>) =>
  (diagnostic: Diagnostic): Diagnostic => {
    if (!WIDTH_ATTRIBUTABLE.has(diagnostic.code) || diagnostic.data?.causedBy !== undefined) return diagnostic;
    const nearest = [diagnostic.path, ...ancestorsOf(diagnostic.path)].flatMap((row) => {
      const cause = causes.get(row);
      return cause !== undefined && isConsequenceOf(diagnostic.path, row, cause) ? [cause] : [];
    })[0];
    return nearest === undefined ? diagnostic : withWidthCause(diagnostic, nearest);
  };

export const attributeCauses = (
  diagnostics: readonly Diagnostic[],
  slide: PositionedSlide,
  overflows: readonly Overflow[],
): readonly Diagnostic[] =>
  diagnostics.map(attribute(causesOf(slide, overflows))).map(attributeWidth(widthCausesOf(slide, overflows)));
