import { fitPolicyOf, minSizeOf, textStyleOf } from '../core/defaults.ts';
import type {
  LayoutEnv,
  PositionedNode,
  PositionedSlide,
  PositionedText,
  Pt,
  ResolvedNode,
  ResolvedSlide,
  ResolvedText,
  SlideSize,
} from '../core/types.ts';
import { layoutSlide } from '../layout/index.ts';
import { detectOverflow, isWidthOverflow } from './detect.ts';
import type { Overflow } from './detect.ts';
import { POLICIES } from './policies.ts';
import type { OverflowPolicy } from './policies.ts';

// Uma tentativa do ajuste (árvore resolvida + layout + estouros) e o que vale para cada Text.

export interface LayoutInput {
  readonly size: SlideSize;
  readonly env: LayoutEnv;
}

/** O que vale para o Text durante todo o ajuste, lido das props ORIGINAIS do autor. */
export interface TextPlan {
  readonly from: Pt;
  /** Nunca acima de `from`: o ajuste não aumenta texto que o autor já fez menor que o piso. */
  readonly min: Pt;
  readonly policy: OverflowPolicy;
}

export type Plans = ReadonlyMap<string, TextPlan>;

export interface Pass {
  readonly resolved: ResolvedSlide;
  readonly positioned: PositionedSlide;
  readonly overflows: readonly Overflow[];
}

export const sizeOf = (text: ResolvedText): Pt => textStyleOf(text.props).size;

export const resolvedTexts = (nodes: readonly ResolvedNode[]): readonly ResolvedText[] =>
  nodes.flatMap((node) => {
    if (node.kind === 'box') return resolvedTexts(node.children);
    return node.kind === 'text' ? [node] : [];
  });

export const positionedNodes = (nodes: readonly PositionedNode[]): readonly PositionedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...positionedNodes(node.children)] : [node]));

const isPositionedText = (node: PositionedNode): node is PositionedText => node.kind === 'text';

export const positionedTexts = (pass: Pass): readonly PositionedText[] =>
  positionedNodes(pass.positioned.children).filter(isPositionedText);

const planOf = (text: ResolvedText): TextPlan => {
  const from = sizeOf(text);
  return { from, min: Math.min(from, minSizeOf(text.props)), policy: POLICIES[fitPolicyOf(text.props)] };
};

export const plansOf = (slide: ResolvedSlide): Plans =>
  new Map(resolvedTexts(slide.children).map((text) => [text.path, planOf(text)]));

export const passOf = (resolved: ResolvedSlide, input: LayoutInput): Pass => {
  const positioned = layoutSlide(resolved, input.size, input.env);
  return { resolved, positioned, overflows: detectOverflow(positioned) };
};

const isText = (overflow: Overflow): boolean => overflow.kind === 'text';

const byPath = (overflows: readonly Overflow[]): ReadonlyMap<string, Overflow> =>
  new Map(overflows.map((overflow) => [overflow.path, overflow]));

/** Estouros de altura dos Text (um Text pode ter também um de largura: mapas separados). */
export const textOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> =>
  byPath(pass.overflows.filter((overflow) => isText(overflow) && !isWidthOverflow(overflow)));

/** Estouros de largura (Text com nowrap). */
export const widthOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> =>
  byPath(pass.overflows.filter((overflow) => isText(overflow) && isWidthOverflow(overflow)));

/** Text com qualquer estouro: não contam para o box do pai (mesma regra da detecção). */
export const overflowingTextPaths = (pass: Pass): ReadonlySet<string> =>
  new Set(pass.overflows.filter(isText).map((overflow) => overflow.path));
