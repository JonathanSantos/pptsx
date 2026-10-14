import { DEFAULTS } from '../../../src/core/defaults.ts';
import { pickResponsive, type ResponsiveContext } from '../../../src/core/responsive.ts';
import type { Children, SlideElement, TextChildren } from '../../../src/core/types.ts';
import { primitiveName } from '../../../src/primitives/index.ts';
import { assertValidChart, assertValidTable, normalizeRows } from '../../../src/resolve/data.ts';
import { ResolveError } from '../../../src/resolve/errors.ts';
import { expandChild, type Expanded, type ExpandedPrimitive } from '../../../src/resolve/expand.ts';
import { assertPaginateInFlow, assertSinglePaginate } from '../../../src/resolve/paginate.ts';
import { resolvePropsOf } from '../../../src/resolve/props.ts';
import type { CssStyle, ResolvedDeck, ResolvedNode, ResolvedSlide } from '../types.ts';
import { legacyPropsOf } from './legacy.ts';
import { normalizeProps, ROOT_TEXT, type InheritedText, type Normalized } from './normalize.ts';
import { cssRunsOf } from './runs.ts';

/**
 * Resolve da PoC: o de src/resolve/resolve.ts (path, componentes, responsivo, validação de
 * Chart/Table, paginate) com a cascata CSS no meio: cada nó é normalizado (shorthands, nomes
 * antigos) e recebe o estilo de texto do pai. `display: none` poda o nó depois do path
 * calculado, para os irmãos manterem os índices de quem lê o JSX.
 */

const SEPARATOR = ' > ';

const joinPath = (parent: string, segment: string): string => (parent === '' ? segment : `${parent}${SEPARATOR}${segment}`);

const nameOf = (item: ExpandedPrimitive): string => primitiveName(item.kind);

const SPAN_OUTSIDE_TEXT = '<Span> só pode aparecer dentro de <Text>';

const onlyPrimitives = (items: readonly Expanded[], parentPath: string): readonly ExpandedPrimitive[] =>
  items.map((item) => {
    if (item.type === 'primitive' && item.kind === 'span') throw new ResolveError(SPAN_OUTSIDE_TEXT, parentPath);
    if (item.type === 'primitive') return item;
    throw new ResolveError(`Texto ${JSON.stringify(String(item.value))} fora de <Text>; envolva o conteúdo em <Text>`, parentPath);
  });

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

/** O pai importa para a validação do Chart: numa célula de grid o tamanho vem da célula. */
interface ParentInfo {
  readonly text: InheritedText;
  readonly css: CssStyle | undefined;
}

type Raw = Readonly<Record<string, unknown>>;

/** Props do elemento com responsivo resolvido, inclusive dentro de `style`. */
const rawPropsOf = (item: ExpandedPrimitive, path: string, ctx: ResponsiveContext): Raw => {
  const props = resolvePropsOf(item.element, item.kind, path, ctx) as Raw;
  const { style } = props;
  if (typeof style !== 'object' || style === null) return props;
  const picked = Object.fromEntries(Object.entries(style).map(([key, value]) => [key, pickResponsive(value, ctx)]));
  return { ...props, style: picked };
};

const normalizedOf = (item: ExpandedPrimitive, path: string, ctx: ResponsiveContext, parent: ParentInfo): Normalized =>
  normalizeProps(item.kind, rawPropsOf(item, path, ctx), parent.text);

const assertNoChildren = (item: ExpandedPrimitive, path: string): void => {
  if (expandChild(item.element.props.children).length === 0) return;
  throw new ResolveError(`<${nameOf(item)}> não aceita filhos`, path);
};

const resolveText = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  const props = legacyPropsOf('text', n);
  const base = {
    weight: n.text.weight ?? DEFAULTS.text.weight,
    italic: n.text.italic ?? DEFAULTS.text.italic,
    color: n.text.color ?? DEFAULTS.text.color,
    underline: n.css.textDecoration.underline,
    lineThrough: n.css.textDecoration.lineThrough,
  };
  const runs = cssRunsOf(item.element.props.children as TextChildren, base, n.css.textTransform, path);
  return { kind: 'text', path, props, css: n.css, content: runs.map((run) => run.text).join(''), runs };
};

/** Gráfico precisa de tamanho de fora: width/height, flex, absoluto ou a célula de um grid. */
const chartHasSize = (css: CssStyle, parent: ParentInfo): boolean =>
  css.width !== undefined ||
  css.height !== undefined ||
  css.flexGrow > 0 ||
  css.position === 'absolute' ||
  parent.css?.display === 'grid';

const resolveChart = (item: ExpandedPrimitive, path: string, n: Normalized, parent: ParentInfo): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('chart', n);
  if (!chartHasSize(n.css, parent)) {
    throw new ResolveError('<Chart> precisa de width, height, flex/flexGrow ou de uma célula de grid: um gráfico não tem tamanho próprio', path);
  }
  // A checagem de tamanho de src já foi feita acima com as regras do CSS; o resto da validação é a da engine.
  assertValidChart({ ...props, position: 'absolute' }, path);
  return { kind: 'chart', path, props, css: n.css };
};

const resolveTable = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('table', n);
  assertValidTable(props, path);
  return { kind: 'table', path, props, css: n.css, rows: normalizeRows(props.rows) };
};

const resolveBox = (item: ExpandedPrimitive, path: string, n: Normalized, ctx: ResponsiveContext): ResolvedNode => {
  const props = legacyPropsOf('box', n);
  assertPaginateInFlow(props, path);
  const children = resolveChildren(item.element.props.children, path, ctx, { text: n.text, css: n.css });
  return { kind: 'box', path, props, css: n.css, children };
};

const resolveNode = (item: ExpandedPrimitive, path: string, ctx: ResponsiveContext, parent: ParentInfo): ResolvedNode => {
  const n = normalizedOf(item, path, ctx, parent);
  switch (item.kind) {
    case 'box':
      return resolveBox(item, path, n, ctx);
    case 'text':
      return resolveText(item, path, n);
    case 'image':
      assertNoChildren(item, path);
      return { kind: 'image', path, props: legacyPropsOf('image', n), css: n.css };
    case 'shape':
      assertNoChildren(item, path);
      return { kind: 'shape', path, props: legacyPropsOf('shape', n), css: n.css };
    case 'chart':
      return resolveChart(item, path, n, parent);
    case 'table':
      return resolveTable(item, path, n);
    case 'span':
      throw new ResolveError(SPAN_OUTSIDE_TEXT, path);
    case 'slide':
    case 'deck':
      throw new ResolveError(`<${nameOf(item)}> só pode aparecer ${item.kind === 'slide' ? 'como filho de <Deck>' : 'na raiz'}`, path);
  }
};

// display: none sai da árvore inteira (layout, fit, emissão), depois dos paths calculados.
const isDisplayed = (node: ResolvedNode): boolean => node.css.display !== 'none';

const resolveChildren = (children: Children, parentPath: string, ctx: ResponsiveContext, parent: ParentInfo): readonly ResolvedNode[] => {
  const items = onlyPrimitives(expandChild(children), parentPath);
  const segments = siblingSegments(items.map((item) => item.segment));
  return items
    .map((item, index) => resolveNode(item, joinPath(parentPath, segments[index] ?? item.segment), ctx, parent))
    .filter(isDisplayed);
};

const resolveSlide = (item: ExpandedPrimitive, index: number, ctx: ResponsiveContext): ResolvedSlide => {
  if (item.kind !== 'slide') {
    throw new ResolveError(`Filhos de <Deck> têm que ser <Slide>; encontrado <${nameOf(item)}>`, item.segment);
  }
  const path = item.segment;
  const n = normalizedOf(item, path, ctx, { text: ROOT_TEXT, css: undefined });
  const slide: ResolvedSlide = {
    kind: 'slide',
    path,
    sourceSlide: index + 1,
    props: legacyPropsOf('slide', n),
    css: n.css,
    children: resolveChildren(item.element.props.children, path, ctx, { text: n.text, css: n.css }),
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

export const resolveDeck = (root: SlideElement, ctx: ResponsiveContext): ResolvedDeck => {
  const deck = expandRoot(root);
  const slides = onlyPrimitives(expandChild(deck.element.props.children), '').map((item, index) => resolveSlide(item, index, ctx));
  return { slides };
};
