import type {
  Children,
  PrimitiveKind,
  PrimitivePropsMap,
  ResolvedDeck,
  ResolvedNode,
  ResolvedSlide,
  SlideElement,
  TextChildren,
} from '../core/types.ts';
import { primitiveName } from '../primitives/index.ts';
import { ResolveError } from './errors.ts';
import { expandChild } from './expand.ts';
import type { Expanded, ExpandedPrimitive } from './expand.ts';

const SEPARATOR = ' > ';

const joinPath = (parent: string, segment: string): string =>
  parent === '' ? segment : `${parent}${SEPARATOR}${segment}`;

type PropsOf<K extends PrimitiveKind> = Omit<PrimitivePropsMap[K], 'children'>;

/** Props como o autor escreveu, sem children. */
const propsOf = <K extends PrimitiveKind>(element: SlideElement): PropsOf<K> => {
  const { children: _children, ...rest } = element.props;
  return rest as unknown as PropsOf<K>;
};

const nameOf = (item: ExpandedPrimitive): string => primitiveName(item.kind);

const describeText = (value: string | number): string => JSON.stringify(String(value));

/** Texto solto fora de Text é erro: a engine não inventa uma caixa para ele. */
const onlyPrimitives = (items: readonly Expanded[], parentPath: string): readonly ExpandedPrimitive[] =>
  items.map((item) => {
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

const flattenText = (children: TextChildren, path: string): string => {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map((child: TextChildren) => flattenText(child, path)).join('');
  throw new ResolveError('<Text> só aceita strings e números como filhos; elementos não são permitidos', path);
};

const assertNoChildren = (item: ExpandedPrimitive, path: string): void => {
  if (expandChild(item.element.props.children).length === 0) return;
  throw new ResolveError(`<${nameOf(item)}> não aceita filhos`, path);
};

const resolveNode = (item: ExpandedPrimitive, path: string): ResolvedNode => {
  switch (item.kind) {
    case 'box':
      return { kind: 'box', path, props: propsOf<'box'>(item.element), children: resolveChildren(item.element.props.children, path) };
    case 'text':
      return { kind: 'text', path, props: propsOf<'text'>(item.element), content: flattenText(item.element.props.children as TextChildren, path) };
    case 'image':
      assertNoChildren(item, path);
      return { kind: 'image', path, props: propsOf<'image'>(item.element) };
    case 'shape':
      assertNoChildren(item, path);
      return { kind: 'shape', path, props: propsOf<'shape'>(item.element) };
    case 'slide':
    case 'deck':
      throw new ResolveError(`<${nameOf(item)}> só pode aparecer ${item.kind === 'slide' ? 'como filho de <Deck>' : 'na raiz'}`, path);
  }
};

const resolveChildren = (children: Children, parentPath: string): readonly ResolvedNode[] => {
  const items = onlyPrimitives(expandChild(children), parentPath);
  const segments = siblingSegments(items.map((item) => item.segment));
  return items.map((item, index) => resolveNode(item, joinPath(parentPath, segments[index] ?? item.segment)));
};

/** O slide é o primeiro segmento do path e não leva índice (o índice vai em Diagnostic.slide). */
const resolveSlide = (item: ExpandedPrimitive): ResolvedSlide => {
  if (item.kind !== 'slide') {
    throw new ResolveError(`Filhos de <Deck> têm que ser <Slide>; encontrado <${nameOf(item)}>`, item.segment);
  }
  const path = item.segment;
  return { kind: 'slide', path, props: propsOf<'slide'>(item.element), children: resolveChildren(item.element.props.children, path) };
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

export const resolveDeck = (root: SlideElement): ResolvedDeck => {
  const deck = expandRoot(root);
  const slides = onlyPrimitives(expandChild(deck.element.props.children), '').map(resolveSlide);
  return { slides };
};
