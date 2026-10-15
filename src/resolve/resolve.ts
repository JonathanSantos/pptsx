import { DEFAULTS } from '../core/defaults.ts';
import type { ResponsiveContext } from '../core/responsive.ts';
import { createResolveEnv, iconGeometryOf, type ResolveEnv } from './icon.ts';
import type {
  Children,
  CssStyle,
  ResolvedConnector,
  ResolvedDeck,
  ResolvedNode,
  ResolvedSlide,
  SlideElement,
  TextChildren,
} from '../core/types.ts';
import { primitiveName } from '../primitives/index.ts';
import { assertChartSize, assertValidChart, assertValidTable, normalizeRows } from './data.ts';
import { ROOT_TEXT } from './draft.ts';
import type { InheritedText } from './draft.ts';
import { InvalidPropError, ResolveError } from './errors.ts';
import { expandChild } from './expand.ts';
import type { Expanded, ExpandedPrimitive } from './expand.ts';
import { legacyPropsOf } from './legacy.ts';
import { normalizeProps } from './normalize.ts';
import type { Normalized } from './normalize.ts';
import { assertPaginateInFlow, assertSinglePaginate } from './paginate.ts';
import { resolvePropsOf } from './props.ts';
import { pathGeometryOf } from './path.ts';
import { resolveConnector, slideIdsOf, withMissing } from './connector.ts';
import { runsOf } from './runs.ts';
import { assertBoxShape, assertValidShape } from './shape.ts';
import type { RunStyle } from './runs.ts';

/**
 * Árvore do autor → árvore resolvida: path, componentes, responsivo e validação, com a
 * cascata CSS no meio: cada nó é normalizado (shorthands, nomes antigos, `style`) e recebe o
 * estilo de texto do pai. `display: none` poda o nó depois do path calculado, para os irmãos
 * manterem os índices de quem lê o JSX.
 */

const SEPARATOR = ' > ';

/** O que desce pela árvore inteira: o contexto responsivo e a IO injetada (leitura de ícones). */
type ResolveScope = ResponsiveContext & { readonly env: ResolveEnv };

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

/** O que desce do pai: o texto herdado e o css (num grid, o tamanho do Chart vem da célula). */
interface ParentInfo {
  readonly text: InheritedText;
  readonly css: CssStyle | undefined;
}

const parentOf = (n: Normalized): ParentInfo => ({ text: n.text, css: n.css });

/** A normalização não conhece o path: o erro de valor ganha aqui o path e a primitiva. */
const normalizedOf = (item: ExpandedPrimitive, path: string, ctx: ResolveScope, parent: ParentInfo): Normalized => {
  const props = resolvePropsOf(item.element, item.kind, path, ctx);
  try {
    return normalizeProps(item.kind, props, parent.text);
  } catch (error) {
    if (!(error instanceof InvalidPropError)) throw error;
    throw new ResolveError(`Prop "${error.property}" de <${nameOf(item)}>: ${error.message}`, path);
  }
};

const assertNoChildren = (item: ExpandedPrimitive, path: string): void => {
  if (expandChild(item.element.props.children).length === 0) return;
  throw new ResolveError(`<${nameOf(item)}> não aceita filhos`, path);
};

const baseRunStyleOf = (n: Normalized): RunStyle => ({
  weight: n.text.weight ?? DEFAULTS.text.weight,
  italic: n.text.italic ?? DEFAULTS.text.italic,
  color: n.text.color ?? DEFAULTS.text.color,
  underline: n.css.textDecoration.underline,
  lineThrough: n.css.textDecoration.lineThrough,
  // M13: o href do Text vale para todos os runs; um Span pode trocar o dele.
  ...(typeof n.own.href === 'string' ? { href: n.own.href } : {}),
});

const resolveText = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  const children = item.element.props.children as TextChildren;
  const runs = runsOf(children, baseRunStyleOf(n), n.css.textTransform, path);
  const content = runs.map((run) => run.text).join('');
  return { kind: 'text', path, props: legacyPropsOf('text', n), css: n.css, content, runs };
};

const resolveChart = (item: ExpandedPrimitive, path: string, n: Normalized, parent: ParentInfo): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('chart', n);
  assertChartSize(n.css, parent.css, path);
  assertValidChart(props, path);
  return { kind: 'chart', path, props, css: n.css };
};

const resolveShape = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('shape', n);
  assertValidShape(props, path);
  return { kind: 'shape', path, props, css: n.css };
};

const resolvePath = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('path', n);
  const { commands, viewBox, problem } = pathGeometryOf(props, path);
  return { kind: 'path', path, props, css: n.css, commands, viewBox, ...(problem === undefined ? {} : { problem }) };
};

const resolveIcon = (item: ExpandedPrimitive, path: string, n: Normalized, env: ResolveEnv): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('icon', n);
  const { viewBox, content } = iconGeometryOf(props, path, env);
  return { kind: 'icon', path, props, css: n.css, viewBox, content };
};

const resolveTable = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('table', n);
  assertValidTable(props, path);
  return { kind: 'table', path, props, css: n.css, rows: normalizeRows(props.rows) };
};

/** Nós de um contêiner e os conectores declarados neles (de qualquer profundidade). */
interface ResolvedChildren {
  readonly nodes: readonly ResolvedNode[];
  readonly connectors: readonly ResolvedConnector[];
}

const NO_CONNECTORS: readonly ResolvedConnector[] = [];

const resolveBox = (item: ExpandedPrimitive, path: string, n: Normalized, ctx: ResolveScope): ResolvedChildren => {
  const props = legacyPropsOf('box', n);
  assertPaginateInFlow(props, path);
  assertBoxShape(props, path);
  const children = resolveChildren(item.element.props.children, path, ctx, parentOf(n));
  // display: none leva junto os conectores declarados dentro do Box.
  const connectors = n.css.display === 'none' ? NO_CONNECTORS : children.connectors;
  return { nodes: [{ kind: 'box', path, props, css: n.css, children: children.nodes }], connectors };
};

const resolveItem = (item: ExpandedPrimitive, path: string, ctx: ResolveScope, parent: ParentInfo): ResolvedChildren => {
  if (item.kind === 'box') return resolveBox(item, path, normalizedOf(item, path, ctx, parent), ctx);
  if (item.kind === 'connector') {
    assertNoChildren(item, path);
    const props = resolvePropsOf(item.element, item.kind, path, ctx);
    const n = normalizeProps('connector', props, parent.text);
    return { nodes: [], connectors: [resolveConnector(props, n.own, path, parent.text)] };
  }
  return { nodes: [resolveNode(item, path, ctx, parent)], connectors: NO_CONNECTORS };
};

const resolveNode = (item: ExpandedPrimitive, path: string, ctx: ResolveScope, parent: ParentInfo): ResolvedNode => {
  const n = normalizedOf(item, path, ctx, parent);
  switch (item.kind) {
    case 'box':
    case 'connector':
      throw new ResolveError(`<${nameOf(item)}> resolvido fora de resolveItem`, path);
    case 'text':
      return resolveText(item, path, n);
    case 'image':
      assertNoChildren(item, path);
      return { kind: 'image', path, props: legacyPropsOf('image', n), css: n.css };
    case 'shape':
      return resolveShape(item, path, n);
    case 'chart':
      return resolveChart(item, path, n, parent);
    case 'table':
      return resolveTable(item, path, n);
    case 'path':
      return resolvePath(item, path, n);
    case 'icon':
      return resolveIcon(item, path, n, ctx.env);
    case 'slideNumber':
      throw new ResolveError(`<${nameOf(item)}> ainda não está disponível`, path);
    case 'span':
      throw new ResolveError(SPAN_OUTSIDE_TEXT, path);
    case 'slide':
    case 'deck':
      throw new ResolveError(`<${nameOf(item)}> só pode aparecer ${item.kind === 'slide' ? 'como filho de <Deck>' : 'na raiz'}`, path);
  }
};

// display: none sai da árvore inteira (layout, fit, emissão), depois dos paths calculados.
const isDisplayed = (node: ResolvedNode): boolean => node.css.display !== 'none';

const resolveChildren = (
  children: Children,
  parentPath: string,
  ctx: ResolveScope,
  parent: ParentInfo,
): ResolvedChildren => {
  const items = onlyPrimitives(expandChild(children), parentPath);
  const segments = siblingSegments(items.map((item) => item.segment));
  const resolved = items.map((item, index) => resolveItem(item, joinPath(parentPath, segments[index] ?? item.segment), ctx, parent));
  return {
    nodes: resolved.flatMap((entry) => entry.nodes).filter(isDisplayed),
    connectors: resolved.flatMap((entry) => entry.connectors),
  };
};

const ROOT_PARENT: ParentInfo = { text: ROOT_TEXT, css: undefined };

/** O slide é o primeiro segmento do path e não leva índice (o índice vai em Diagnostic.slide). */
const resolveSlide = (item: ExpandedPrimitive, index: number, ctx: ResolveScope): ResolvedSlide => {
  if (item.kind !== 'slide') {
    throw new ResolveError(`Filhos de <Deck> têm que ser <Slide>; encontrado <${nameOf(item)}>`, item.segment);
  }
  const path = item.segment;
  const n = normalizedOf(item, path, ctx, ROOT_PARENT);
  const { nodes, connectors } = resolveChildren(item.element.props.children, path, ctx, parentOf(n));
  const ids = slideIdsOf(nodes);
  const slide: ResolvedSlide = {
    kind: 'slide',
    path,
    sourceSlide: index + 1,
    props: legacyPropsOf('slide', n),
    css: n.css,
    children: nodes,
    ...(connectors.length === 0 ? {} : { connectors: connectors.map((connector) => withMissing(connector, ids)) }),
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

/** Valores responsivos são resolvidos aqui para `ctx`; a árvore resolvida só tem valores concretos. */
export const resolveDeck = (root: SlideElement, responsive: ResponsiveContext, env: ResolveEnv = createResolveEnv()): ResolvedDeck => {
  const ctx: ResolveScope = { ...responsive, env };
  const deck = expandRoot(root);
  const slides = onlyPrimitives(expandChild(deck.element.props.children), '').map((item, index) =>
    resolveSlide(item, index, ctx),
  );
  return { slides };
};
