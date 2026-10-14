import type { ResponsiveContext } from '../core/responsive.ts';
import type {
  Children,
  ResolvedDeck,
  ResolvedNode,
  ResolvedSlide,
  SlideElement,
  TextChildren,
} from '../core/types.ts';
import { primitiveName } from '../primitives/index.ts';
import { ResolveError } from './errors.ts';
import { expandChild } from './expand.ts';
import { assertPaginateInFlow, assertSinglePaginate } from './paginate.ts';
import { resolvePropsOf } from './props.ts';
import { runsOf } from './runs.ts';
import type { Expanded, ExpandedPrimitive } from './expand.ts';

const SEPARATOR = ' > ';

const joinPath = (parent: string, segment: string): string =>
  parent === '' ? segment : `${parent}${SEPARATOR}${segment}`;

const nameOf = (item: ExpandedPrimitive): string => primitiveName(item.kind);

const describeText = (value: string | number): string => JSON.stringify(String(value));

const SPAN_OUTSIDE_TEXT = '<Span> só pode aparecer dentro de <Text>';

/**
 * Texto solto fora de Text é erro: a engine não inventa uma caixa para ele.
 * Span idem: estilo inline sem Text não tem onde morar; o erro aponta para o pai.
 */
const onlyPrimitives = (items: readonly Expanded[], parentPath: string): readonly ExpandedPrimitive[] =>
  items.map((item) => {
    if (item.type === 'primitive' && item.kind === 'span') throw new ResolveError(SPAN_OUTSIDE_TEXT, parentPath);
    if (item.type === 'primitive') return item;
    throw new ResolveError(
      `Texto ${describeText(item.value)} fora de <Text>; envolva o conteúdo em <Text>`,
      parentPath,
    );
  });

/** Sufixo [i] só quando há irmãos com o mesmo segmento. */
const siblingSegments = (segments: readonly string[]): readonly string[] => {
  const totals = new Map<string, number>();
  segments.forEach((segment) => totals.set(segment, (totals.get(segment) ?? 0) + 1));
  const seen = new Map<string, number>();
  return segments.map((segment) => {
    if (totals.get(segment) === 1) return segment;
    const index = seen.get(segment) ?? 0;
    seen.set(segment, index + 1);
    return `${segment}[${index}]`;
  });
};

const resolveText = (item: ExpandedPrimitive, path: string, ctx: ResponsiveContext): ResolvedNode => {
  const props = resolvePropsOf(item.element, 'text', path, ctx);
  const runs = runsOf(item.element.props.children as TextChildren, props, path);
  return { kind: 'text', path, props, content: runs.map((run) => run.text).join(''), runs };
};

const assertNoChildren = (item: ExpandedPrimitive, path: string): void => {
  if (expandChild(item.element.props.children).length === 0) return;
  throw new ResolveError(`<${nameOf(item)}> não aceita filhos`, path);
};

const resolveBox = (item: ExpandedPrimitive, path: string, ctx: ResponsiveContext): ResolvedNode => {
  const props = resolvePropsOf(item.element, 'box', path, ctx);
  assertPaginateInFlow(props, path);
  return { kind: 'box', path, props, children: resolveChildren(item.element.props.children, path, ctx) };
};

const resolveNode = (item: ExpandedPrimitive, path: string, ctx: ResponsiveContext): ResolvedNode => {
  switch (item.kind) {
    case 'box':
      return resolveBox(item, path, ctx);
    case 'text':
      return resolveText(item, path, ctx);
    case 'image':
      assertNoChildren(item, path);
      return { kind: 'image', path, props: resolvePropsOf(item.element, 'image', path, ctx) };
    case 'shape':
      assertNoChildren(item, path);
      return { kind: 'shape', path, props: resolvePropsOf(item.element, 'shape', path, ctx) };
    case 'span':
      throw new ResolveError(SPAN_OUTSIDE_TEXT, path);
    case 'slide':
    case 'deck':
      throw new ResolveError(`<${nameOf(item)}> só pode aparecer ${item.kind === 'slide' ? 'como filho de <Deck>' : 'na raiz'}`, path);
  }
};

const resolveChildren = (children: Children, parentPath: string, ctx: ResponsiveContext): readonly ResolvedNode[] => {
  const items = onlyPrimitives(expandChild(children), parentPath);
  const segments = siblingSegments(items.map((item) => item.segment));
  return items.map((item, index) => resolveNode(item, joinPath(parentPath, segments[index] ?? item.segment), ctx));
};

/** O slide é o primeiro segmento do path e não leva índice (o índice vai em Diagnostic.slide). */
const resolveSlide = (item: ExpandedPrimitive, index: number, ctx: ResponsiveContext): ResolvedSlide => {
  if (item.kind !== 'slide') {
    throw new ResolveError(`Filhos de <Deck> têm que ser <Slide>; encontrado <${nameOf(item)}>`, item.segment);
  }
  const path = item.segment;
  const slide: ResolvedSlide = {
    kind: 'slide',
    path,
    sourceSlide: index + 1,
    props: resolvePropsOf(item.element, 'slide', path, ctx),
    children: resolveChildren(item.element.props.children, path, ctx),
  };
  assertSinglePaginate(slide);
  return slide;
};

const expandRoot = (root: SlideElement): ExpandedPrimitive => {
  const items = onlyPrimitives(expandChild(root), '');
  const [deck] = items;
  if (items.length !== 1 || deck === undefined) {
    throw new ResolveError(`A raiz tem que ser um único <Deck>; encontrados ${items.length} elementos`, '');
  }
  if (deck.kind !== 'deck') throw new ResolveError(`A raiz tem que ser <Deck>; encontrado <${nameOf(deck)}>`, deck.segment);
  return deck;
};

/** Valores responsivos das primitivas são resolvidos aqui para `ctx`; a árvore resolvida só tem valores concretos. */
export const resolveDeck = (root: SlideElement, ctx: ResponsiveContext): ResolvedDeck => {
  const deck = expandRoot(root);
  const slides = onlyPrimitives(expandChild(deck.element.props.children), '').map((item, index) =>
    resolveSlide(item, index, ctx),
  );
  return { slides };
};
