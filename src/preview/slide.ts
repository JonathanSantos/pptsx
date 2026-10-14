import { containerOf } from '../core/defaults.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type {
  PositionedBox,
  PositionedNode,
  PositionedSlide,
  PositionedTable,
  PositionedText,
  Rect,
  SlideSize,
} from '../core/types.ts';
import { chartSvg } from './chart.ts';
import { loadImageUri } from './image.ts';
import {
  backgroundColorSvg,
  boxSvg,
  debugOutlineSvg,
  imageElementSvg,
  imageSvg,
  overflowRectsOf,
  overflowSvg,
  shapeSvg,
  textOverflowRectOf,
  textOverflowSvg,
  textSvg,
  textWidthOverflowRectOf,
} from './svg.ts';
import { tableOverflowRectOf, tableSvg } from './table.ts';
import { attrs } from './xml.ts';

export interface SvgOptions {
  readonly widthPx: number;
  readonly debug?: boolean;
  readonly baseDir: string;
  /** família lógica → nome interno da fonte que o resvg conhece (ex.: Arial → Liberation Sans) */
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  /** leitura de arquivo injetável (padrão fs.readFileSync) para manter o SVG testável */
  readonly readFile?: (path: string) => Buffer;
}

/** Nó achatado em ordem de árvore, com o frame do pai para o realce de overflow. */
interface DrawItem {
  readonly node: PositionedNode;
  readonly parent: Rect;
  /** Área de conteúdo do pai (frame menos padding): limite da largura de um nowrap. */
  readonly parentContent: Rect;
  readonly index: number;
  /** position="absolute" (ou dentro de um): decoração intencional, pode sair do pai. */
  readonly absolute: boolean;
}

/** Mesma conta do fit (contentOf em fit/geometry.ts). */
const contentOf = (container: PositionedSlide | PositionedBox): Rect => {
  const { padding } = containerOf(container.props);
  const { x, y, width, height } = container.frame;
  return {
    x: x + padding.left,
    y: y + padding.top,
    width: Math.max(0, width - padding.left - padding.right),
    height: Math.max(0, height - padding.top - padding.bottom),
  };
};

const flatten = (
  nodes: readonly PositionedNode[],
  parent: PositionedSlide | PositionedBox,
  insideAbsolute: boolean,
): readonly Omit<DrawItem, 'index'>[] =>
  nodes.flatMap((node) => {
    const absolute = insideAbsolute || node.props.position === 'absolute';
    const children = node.kind === 'box' ? flatten(node.children, node, absolute) : [];
    return [{ node, parent: parent.frame, parentContent: contentOf(parent), absolute }, ...children];
  });

const drawItemsOf = (slide: PositionedSlide): readonly DrawItem[] =>
  flatten(slide.children, slide, false).map((item, index) => ({ ...item, index }));

interface DrawContext {
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  readonly loadImage: (src: string) => string;
}

const drawers: DispatchTable<PositionedNode, string, [ctx: DrawContext, index: number]> = {
  box: (node) => boxSvg(node),
  text: (node, ctx) => textSvg(node, { fontFamilyMap: ctx.fontFamilyMap }),
  image: (node, ctx, index) => imageSvg(node, ctx.loadImage(node.props.src), `clip-${index}`),
  shape: (node) => shapeSvg(node),
  chart: (node, ctx) => chartSvg(node, { fontFamilyMap: ctx.fontFamilyMap }),
  table: (node, ctx, index) => tableSvg(node, { fontFamilyMap: ctx.fontFamilyMap }, `clip-${index}`),
};

const drawItem = (item: DrawItem, ctx: DrawContext): string => dispatch(drawers, item.node, ctx, item.index);

const BACKGROUND_CLIP_ID = 'clip-background';

/** Slide sem fundo é branco no PowerPoint/Keynote; o PNG não deve sair transparente. */
const DEFAULT_BACKGROUND = '#FFFFFF';

const backgroundSvg = (slide: PositionedSlide, area: Rect, ctx: DrawContext): string => {
  const { background } = slide.props;
  const base = backgroundColorSvg(area, typeof background === 'string' ? background : DEFAULT_BACKGROUND);
  if (background === undefined || typeof background === 'string') return base;
  return base + imageElementSvg(area, ctx.loadImage(background.image), 'cover', BACKGROUND_CLIP_ID);
};

const outsideParentSvg = (item: DrawItem): string =>
  item.absolute ? '' : overflowRectsOf(item.node.frame, item.parent).map(overflowSvg).join('');

/** Largura disponível como no fit: em fluxo, o frame cortado pela área de conteúdo do pai. */
const availableWidthOf = (node: PositionedText, content: Rect): number => {
  if (node.props.position === 'absolute') return node.frame.width;
  const right = Math.min(node.frame.x + node.frame.width, content.x + content.width);
  return Math.max(0, right - node.frame.x);
};

const textBandsOf = (node: PositionedText, content: Rect): readonly Rect[] =>
  [textOverflowRectOf(node), textWidthOverflowRectOf(node, availableWidthOf(node, content))].filter(
    (band): band is Rect => band !== undefined,
  );

const tableBandsOf = (node: PositionedTable): readonly Rect[] => {
  const band = tableOverflowRectOf(node);
  return band === undefined ? [] : [band];
};

const bandsOf = (node: PositionedNode, content: Rect): readonly Rect[] => {
  if (node.kind === 'text') return textBandsOf(node, content);
  if (node.kind === 'table') return tableBandsOf(node);
  return [];
};

/**
 * Texto que estoura a caixa (altura ou, com nowrap, largura) e tabela mais alta que o frame
 * ganham destaque sólido; os demais, o tracejado padrão.
 */
const outlineSvg = (item: DrawItem): string => {
  const { node } = item;
  if (node.kind === 'shape') return '';
  const bands = bandsOf(node, item.parentContent);
  return bands.length === 0 ? debugOutlineSvg(node.frame) : textOverflowSvg(node.frame, bands);
};

/** Debug fica por cima de tudo para não ser escondido por fills. */
const debugSvg = (items: readonly DrawItem[]): string =>
  [...items.map(outsideParentSvg), ...items.map(outlineSvg)].join('');

export const slideToSvg = (slide: PositionedSlide, size: SlideSize, options: SvgOptions): string => {
  const ctx: DrawContext = {
    fontFamilyMap: options.fontFamilyMap,
    loadImage: (src) => loadImageUri(src, options.baseDir, options.readFile),
  };
  const items = drawItemsOf(slide);
  const area: Rect = { x: 0, y: 0, width: size.width, height: size.height };
  const body = [
    backgroundSvg(slide, area, ctx),
    ...items.map((item) => drawItem(item, ctx)),
    options.debug ? debugSvg(items) : '',
  ].join('');
  const root = attrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${size.width} ${size.height}`,
    width: options.widthPx,
    height: Math.round((options.widthPx * size.height) / size.width),
  });
  return `<svg${root}>${body}</svg>`;
};
