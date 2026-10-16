import { DEFAULTS } from '../core/defaults.ts';
import type { ResponsiveContext } from '../core/responsive.ts';
import { createResolveEnv, iconGeometryOf, type ResolveEnv } from './icon.ts';
import type {
  Children,
  CssStyle,
  ResolvedConnector,
  SlideNumberFormat,
  SlideNumberProps,
  TextProps,
  ResolvedDeck,
  ResolvedNode,
  ResolvedSlide,
  SlideElement,
  TextChildren,
  ContainerBox,
  ContainerBreakpoint,
  ContainerResponsive,
  ContainerResponsiveValue,
  DeckContext,
  ResolvedBox,
} from '../core/types.ts';
import { Box, primitiveName } from '../primitives/index.ts';
import { jsx } from '../jsx/jsx-runtime.ts';
import { assertChartSize, assertValidChart, assertValidTable } from './data.ts';
import { tableGridOf } from './table-grid.ts';
import { ROOT_TEXT } from './draft.ts';
import type { InheritedText } from './draft.ts';
import { InvalidPropError, RemovedPropError, ResolveError } from './errors.ts';
import { expandChild } from './expand.ts';
import type { Expanded, ExpandedPrimitive } from './expand.ts';
import { legacyPropsOf } from './legacy.ts';
import { normalizeProps } from './normalize.ts';
import type { Normalized } from './normalize.ts';
import { assertPlaceholders, assertUniqueLayoutNames, notesOf, resolvedLayoutOf, sectionsOf, withFixed } from './layout.ts';
import { assertPaginateInFlow, assertSinglePaginate, assertTablePaginate, assertTextPaginate } from './paginate.ts';
import { resolvePropsOf } from './props.ts';
import { pathGeometryOf } from './path.ts';
import { resolveConnector, scopeIds, withMissing } from './connector.ts';
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

/**
 * M19: medida de um `<Container>` feita pela passada anterior: o frame (border-box, que o Box fixa) e a content
 * box (o que a função recebe). Chave: `containerKeyOf(slide, path)`.
 */
export interface ContainerMeasure {
  readonly frame: { readonly width: number; readonly height: number };
  readonly content: { readonly width: number; readonly height: number };
}
export type ContainerMeasures = ReadonlyMap<string, ContainerMeasure>;

/** Slide (índice do autor, base 0) + path: o path sozinho se repete entre slides. */
export const containerKeyOf = (slideIndex: number, path: string): string => `${slideIndex}|${path}`;

/**
 * O que desce pela árvore inteira: o contexto responsivo, a IO injetada (leitura de ícones) e, no M19, as
 * medidas dos Containers e o índice do slide (para achar a medida de cada um).
 */
type ResolveScope = ResponsiveContext & {
  readonly env: ResolveEnv;
  readonly containers?: ContainerMeasures;
  readonly slideIndex?: number;
};

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
    throw new ResolveError(`Prop "${error.property}" de <${nameOf(item)}>: ${error.message}`, path, error instanceof RemovedPropError);
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
  const props = legacyPropsOf('text', n);
  assertTextPaginate(props, n.css.position, path);
  return { kind: 'text', path, props, css: n.css, content, runs };
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

const SLIDE_NUMBER_FORMATS: readonly SlideNumberFormat[] = ['n', 'n / total'];

/** M13: Text de uma linha medido no pior caso; o número real entra depois da paginação (fit). */
const resolveSlideNumber = (item: ExpandedPrimitive, path: string, n: Normalized): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('slideNumber', n) as Omit<SlideNumberProps, 'children'> & Omit<TextProps, 'children'>;
  const format = props.format ?? 'n';
  if (!SLIDE_NUMBER_FORMATS.includes(format)) throw new ResolveError(`<SlideNumber>: format ${JSON.stringify(format)} inválido; use "n" ou "n / total"`, path);
  const { format: _format, ...textProps } = props;
  const sample = format === 'n' ? DEFAULTS.text.slideNumberSample.n : DEFAULTS.text.slideNumberSample.total;
  const runs = [{ ...baseRunStyleOf(n), text: sample }];
  return { kind: 'text', path, props: { ...textProps, nowrap: true }, css: n.css, content: sample, runs, slideNumber: { format } };
};

const resolveTable = (item: ExpandedPrimitive, path: string, n: Normalized, env: ResolveEnv): ResolvedNode => {
  assertNoChildren(item, path);
  const props = legacyPropsOf('table', n);
  assertValidTable(props, path);
  assertTablePaginate(props, n.css.position, path);
  const { grid, headerCount, rows } = tableGridOf(props, path, env);
  return { kind: 'table', path, props, css: n.css, rows, grid, headerCount };
};

/** Nós de um contêiner e os conectores declarados neles (de qualquer profundidade). */
interface ResolvedChildren {
  readonly nodes: readonly ResolvedNode[];
  readonly connectors: readonly ResolvedConnector[];
}

const NO_CONNECTORS: readonly ResolvedConnector[] = [];

const resolveBox = (item: ExpandedPrimitive, path: string, n: Normalized, ctx: ResolveScope): ResolvedChildren => {
  const props = legacyPropsOf('box', n);
  assertPaginateInFlow(props, n.css.position, path);
  assertBoxShape(props, path);
  const children = resolveChildren(item.element.props.children, path, ctx, parentOf(n));
  // M19: a paginação divide o conteúdo depois do layout; um Container lá dentro não teria um espaço único para medir.
  if (props.paginate === true && hasContainer(children.nodes)) throw new ResolveError('<Container> não pode ficar dentro de um Box paginate', path);
  // display: none leva junto os conectores declarados dentro do Box.
  const connectors = n.css.display === 'none' ? NO_CONNECTORS : children.connectors;
  return { nodes: [{ kind: 'box', path, props, css: n.css, children: children.nodes }], connectors };
};

const CONTAINER_NEEDS_FUNCTION = '<Container> precisa de uma função como filho: {(box) => …} (ela recebe o espaço medido)';

const hasContainer = (nodes: readonly ResolvedNode[]): boolean =>
  nodes.some((node) => node.kind === 'box' && (node.container !== undefined || hasContainer(node.children)));

/** O espaço medido como a função o recebe: content box, breakpoints de contêiner e o contexto do slide. */
const containerBoxOf = (measure: ContainerMeasure, ctx: ResolveScope): ContainerBox => {
  const { width, height } = measure.content;
  const narrow = width < DEFAULTS.containerQuery.narrow;
  const short = height < DEFAULTS.containerQuery.short;
  const pick = <T,>(value: ContainerResponsive<T>): T => {
    if (!isContainerResponsive(value)) return value;
    const keys: readonly ContainerBreakpoint[] = narrow && short ? ['small', 'narrow', 'short'] : narrow ? ['narrow'] : short ? ['short'] : [];
    const key = keys.find((name) => value[name] !== undefined);
    return key === undefined ? value.base : (value[key] as T);
  };
  const slide = { name: ctx.name, aspect: ctx.aspect, scale: ctx.scale } as DeckContext;
  return { width, height, aspect: height > 0 ? width / height : 0, narrow, short, pick, slide: 'pick' in ctx ? (ctx as unknown as DeckContext) : slide };
};

const isContainerResponsive = <T,>(value: ContainerResponsive<T>): value is ContainerResponsiveValue<T> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.hasOwn(value, 'base');

/**
 * M19: Container = Box. Sem medida (1ª passada) fica vazio e 'pending', para o layout medir o espaço que o pai lhe
 * dá. Com medida, chama a função e fixa largura/altura no frame medido (contenção de tamanho): o conteúdo escolhido
 * não muda o espaço, então irmãos e paths ficam iguais aos da passada que mediu.
 */
const resolveContainer = (item: ExpandedPrimitive, path: string, n: Normalized, ctx: ResolveScope): ResolvedChildren => {
  const props = legacyPropsOf('container', n) as ResolvedBox['props'];
  const content = item.element.props.children;
  if (typeof content !== 'function') throw new ResolveError(CONTAINER_NEEDS_FUNCTION, path);
  const measure = ctx.containers?.get(containerKeyOf(ctx.slideIndex ?? 0, path));
  if (measure === undefined) return { nodes: [{ kind: 'box', path, props, css: n.css, children: [], container: 'pending' }], connectors: NO_CONNECTORS };
  const fill = (content as (box: ContainerBox) => Children)(containerBoxOf(measure, ctx));
  const children = resolveChildren(fill, path, ctx, parentOf(n));
  const css: CssStyle = { ...n.css, width: measure.frame.width, height: measure.frame.height, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' };
  const connectors = n.css.display === 'none' ? NO_CONNECTORS : children.connectors;
  return { nodes: [{ kind: 'box', path, props, css, children: children.nodes, container: 'measured' }], connectors };
};

/** M17: o nó que a primitiva gerou leva a identidade do componente (os filhos levam a deles). */
const withComponent = (item: ExpandedPrimitive, resolved: ResolvedChildren): ResolvedChildren => {
  const [first, ...rest] = resolved.nodes;
  if (item.component === undefined || first === undefined) return resolved;
  return { ...resolved, nodes: [{ ...first, component: item.component, ...(item.source === undefined ? {} : { source: item.source }) }, ...rest] };
};

const resolveItem = (item: ExpandedPrimitive, path: string, ctx: ResolveScope, parent: ParentInfo): ResolvedChildren =>
  withComponent(item, resolvePrimitive(item, path, ctx, parent));

const resolvePrimitive = (item: ExpandedPrimitive, path: string, ctx: ResolveScope, parent: ParentInfo): ResolvedChildren => {
  if (item.kind === 'box') return resolveBox(item, path, normalizedOf(item, path, ctx, parent), ctx);
  if (item.kind === 'container') return resolveContainer(item, path, normalizedOf(item, path, ctx, parent), ctx);
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
    case 'container':
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
      return resolveTable(item, path, n, ctx.env);
    case 'path':
      return resolvePath(item, path, n);
    case 'icon':
      return resolveIcon(item, path, n, ctx.env);
    case 'slideNumber':
      return resolveSlideNumber(item, path, n);
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

/**
 * M13: o `footer` do Deck entra em cada slide como último filho, num invólucro absoluto do tamanho do
 * slide com o conteúdo empurrado para a base. O componente tem nome próprio, então o path é
 * `Slide > Footer > …` e os índices dos irmãos do autor não mudam.
 */
function Footer({ children }: { readonly children?: Children }): SlideElement {
  return jsx(Box, { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', children });
}

const withFooter = (children: Children, footer: Children | undefined): Children =>
  footer === undefined || footer === null || footer === false ? children : [children, jsx(Footer, { children: footer })];

/** O slide é o primeiro segmento do path e não leva índice (o índice vai em Diagnostic.slide). */
const resolveSlide = (item: ExpandedPrimitive, index: number, ctx: ResolveScope, footer?: Children): ResolvedSlide => {
  if (item.kind !== 'slide') {
    throw new ResolveError(`Filhos de <Deck> têm que ser <Slide>; encontrado <${nameOf(item)}>`, item.segment);
  }
  const path = item.segment;
  const n = normalizedOf(item, path, ctx, ROOT_PARENT);
  const children = withFooter(withFixed(item.element.props.children, item.layout), footer);
  const resolved = resolveChildren(children, path, { ...ctx, slideIndex: index }, parentOf(n));
  const { nodes, connectors, ids } = scopeIds(resolved.nodes, resolved.connectors);
  const layout = item.layout === undefined ? undefined : resolvedLayoutOf(item.layout, path);
  assertPlaceholders(nodes, layout);
  const notes = notesOf(n.own.notes, path);
  const slide: ResolvedSlide = {
    kind: 'slide',
    path,
    sourceSlide: index + 1,
    props: legacyPropsOf('slide', n),
    css: n.css,
    children: nodes,
    ...(notes === undefined ? {} : { notes }),
    ...(layout === undefined ? {} : { layout }),
    ...(item.component === undefined ? {} : { component: item.component }),
    ...(item.source === undefined ? {} : { source: item.source }),
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
export const resolveDeck = (
  root: SlideElement,
  responsive: ResponsiveContext,
  env: ResolveEnv = createResolveEnv(),
  containers?: ContainerMeasures,
): ResolvedDeck => {
  const ctx: ResolveScope = { ...responsive, env, ...(containers === undefined ? {} : { containers }) };
  const deck = expandRoot(root);
  const footer = deck.element.props.footer as Children | undefined;
  const items = onlyPrimitives(expandChild(deck.element.props.children), '');
  assertUniqueLayoutNames(items.flatMap((item) => (item.layout === undefined ? [] : [[item.layout, item.segment] as const])));
  const slides = items.map((item, index) => resolveSlide(item, index, ctx, footer));
  const sections = sectionsOf(deck.element.props.sections, slides.length);
  return { slides, ...(sections === undefined ? {} : { sections }) };
};
