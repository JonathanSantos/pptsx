import type { PositionedNode, PositionedSlide, Rect, SlideSize } from '../core/types.ts';
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
} from './svg.ts';
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
  readonly index: number;
  /** position="absolute" (ou dentro de um): decoração intencional, pode sair do pai. */
  readonly absolute: boolean;
}

const flatten = (
  nodes: readonly PositionedNode[],
  parent: Rect,
  insideAbsolute: boolean,
): readonly Omit<DrawItem, 'index'>[] =>
  nodes.flatMap((node) => {
    const absolute = insideAbsolute || node.props.position === 'absolute';
    const children = node.kind === 'box' ? flatten(node.children, node.frame, absolute) : [];
    return [{ node, parent, absolute }, ...children];
  });

const drawItemsOf = (slide: PositionedSlide): readonly DrawItem[] =>
  flatten(slide.children, slide.frame, false).map((item, index) => ({ ...item, index }));

interface DrawContext {
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  readonly loadImage: (src: string) => string;
}

type NodeKind = PositionedNode['kind'];
type NodeOf<K extends NodeKind> = Extract<PositionedNode, { kind: K }>;
type NodeDrawer<K extends NodeKind> = (node: NodeOf<K>, ctx: DrawContext, index: number) => string;

const drawers: { readonly [K in NodeKind]: NodeDrawer<K> } = {
  box: (node) => boxSvg(node),
  text: (node, ctx) => textSvg(node, { fontFamilyMap: ctx.fontFamilyMap }),
  image: (node, ctx, index) => imageSvg(node, ctx.loadImage(node.props.src), `clip-${index}`),
  shape: (node) => shapeSvg(node),
};

const drawItem = (item: DrawItem, ctx: DrawContext): string => {
  const drawer = drawers[item.node.kind] as NodeDrawer<NodeKind>;
  return drawer(item.node as never, ctx, item.index);
};

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

/** Texto que estoura a caixa ganha destaque sólido; os demais, o contorno tracejado padrão. */
const outlineSvg = (node: PositionedNode): string => {
  if (node.kind === 'shape') return '';
  const band = node.kind === 'text' ? textOverflowRectOf(node) : undefined;
  return band === undefined ? debugOutlineSvg(node.frame) : textOverflowSvg(node.frame, band);
};

/** Debug fica por cima de tudo para não ser escondido por fills. */
const debugSvg = (items: readonly DrawItem[]): string =>
  [...items.map(outsideParentSvg), ...items.map((item) => outlineSvg(item.node))].join('');

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
