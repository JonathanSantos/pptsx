import { isResponsive } from '../../../src/core/responsive.ts';
import type { Child, DeckDefinition, PrimitiveKind } from '../../../src/core/types.ts';
import { expandChild, type ExpandedPrimitive } from '../../../src/resolve/expand.ts';
import { createContext, resolveSize } from '../../../src/sizes.ts';

/**
 * H1: o que o autor escreve, contado no deck expandido (componentes chamados, como o resolve faz):
 * - nós: primitivas (Deck fora; Span conta);
 * - props: chaves escritas em cada primitiva (sem children/key; cada entrada de `style` conta);
 * - responsivas: props com objeto { base, … };
 * - Boxes só para empurrar: Box sem pintura (fundo, borda, contorno, sombra, imagem) com 0 ou 1 filho.
 */

export interface Counts {
  readonly nodes: number;
  readonly props: number;
  readonly responsive: number;
  readonly pushBoxes: number;
}

const PAINT = ['fill', 'stroke', 'backgroundColor', 'background', 'backgroundImage', 'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'boxShadow'];
const ZERO: Counts = { nodes: 0, props: 0, responsive: 0, pushBoxes: 0 };

const add = (a: Counts, b: Counts): Counts => ({ nodes: a.nodes + b.nodes, props: a.props + b.props, responsive: a.responsive + b.responsive, pushBoxes: a.pushBoxes + b.pushBoxes });

const primitivesOf = (child: Child): readonly ExpandedPrimitive[] =>
  expandChild(child).flatMap((item) => (item.type === 'primitive' ? [item] : []));

const countItem = (item: ExpandedPrimitive): Counts => {
  const { children, style, ...rest } = item.element.props as Record<string, unknown>;
  const styleEntries = typeof style === 'object' && style !== null ? Object.values(style) : [];
  const values = [...Object.values(rest).filter((v) => v !== undefined), ...styleEntries];
  const kids = primitivesOf(children as Child);
  const painted = PAINT.some((key) => rest[key] !== undefined);
  const own: Counts = {
    nodes: item.kind === ('deck' as PrimitiveKind) ? 0 : 1,
    props: values.length,
    responsive: values.filter((v) => isResponsive(v as never)).length,
    pushBoxes: item.kind === 'box' && !painted && kids.length <= 1 ? 1 : 0,
  };
  return kids.map(countItem).reduce(add, own);
};

export const countDeck = (deck: DeckDefinition, size: string = '16x9'): Counts => {
  const resolved = resolveSize(size as never);
  return primitivesOf(deck(createContext(resolved))).map(countItem).reduce(add, ZERO);
};
