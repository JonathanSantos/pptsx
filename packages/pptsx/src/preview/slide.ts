import { slideBackgroundOf } from '../core/defaults.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type { PositionedNode, PositionedSlide, PositionedTable, PositionedText, Rect, SlideSize } from '../core/types.ts';
import { paintOrderOf, type PaintItem } from '../emit/paint.ts';
import { contentRectOf } from '../layout/index.ts';
import { chartSvg } from './chart.ts';
import { connectorSvg } from './connector.ts';
import { decorationSvg } from './decoration.ts';
import { loadImageUri } from './image.ts';
import {
  backgroundColorSvg,
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
import { iconSvg, pathSvg } from './vector.ts';
import { attrs, element } from './xml.ts';

/**
 * Preview SVG do slide (M11): a mesma ordem de pintura do emissor (`paintOrderOf`) e a mesma
 * pintura CSS (fundo, bordas, sombra, opacidade, rotação). O preview é do .pptx: o que não sai
 * no arquivo (css-not-emitted) também não é desenhado.
 */

export interface SvgOptions {
  readonly widthPx: number;
  readonly debug?: boolean;
  readonly baseDir: string;
  /** família lógica → nome interno da fonte que o resvg conhece (ex.: Arial → Liberation Sans) */
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  /** leitura de arquivo injetável (padrão fs.readFileSync) para manter o SVG testável */
  readonly readFile?: (path: string) => Buffer;
  /** Idioma dos números do gráfico (separador decimal); padrão DEFAULTS.lang. */
  readonly lang?: string;
}

interface DrawContext {
  readonly fontFamilyMap?: Readonly<Record<string, string>>;
  readonly lang?: string;
  readonly loadImage: (src: string) => string;
}

/** Área de conteúdo: frame − borda − padding (mesma conta do layout e do fit). */
const contentOf = <N extends PositionedNode>(node: N): N => ({ ...node, frame: contentRectOf(node.frame, node.box) });

// Box não tem conteúdo próprio: a pintura dele é a decoração, e os filhos são itens próprios.
const drawers: DispatchTable<PositionedNode, string, [ctx: DrawContext, index: number]> = {
  box: () => '',
  text: (node, ctx) => textSvg(contentOf(node), { fontFamilyMap: ctx.fontFamilyMap }),
  image: (node, ctx, index) => imageSvg(contentOf(node), ctx.loadImage(node.props.src), `clip-${index}`),
  shape: (node) => shapeSvg(node),
  chart: (node, ctx) => chartSvg(contentOf(node), { fontFamilyMap: ctx.fontFamilyMap, lang: ctx.lang }),
  table: (node, ctx, index) => tableSvg(contentOf(node), { fontFamilyMap: ctx.fontFamilyMap }, `clip-${index}`),
  path: (node, _ctx, index) => pathSvg(node, index),
  icon: (node, _ctx, index) => iconSvg(node, index),
};

const transformOf = (item: PaintItem): string | undefined =>
  item.rotations.length === 0 ? undefined : item.rotations.map((r) => `rotate(${r.degrees} ${r.cx} ${r.cy})`).join(' ');

/** Opacidade e rotação herdadas num <g> (o emissor aplica as mesmas em cada forma). */
const groupOf = (item: PaintItem, body: string): string => {
  const transform = transformOf(item);
  if (body === '' || (transform === undefined && item.opacity === 1)) return body;
  return element('g', { transform, opacity: item.opacity === 1 ? undefined : item.opacity }, body);
};

/** Gráfico e tabela nativos não giram nem ficam translúcidos no PPTX (css-not-emitted): só a decoração. */
const isNativeFrame = (node: PositionedNode): boolean => node.kind === 'chart' || node.kind === 'table';

/** M13: link do nó (Box, Image, Text) já traduzido pelo fit. */
const hrefOfNode = (node: PositionedNode): string | undefined =>
  node.kind === 'box' || node.kind === 'image' || node.kind === 'text' ? node.props.href : undefined;

/** O SVG ganha o link (o PNG não muda): `slide:N` vira âncora `#slide-N`. */
const linked = (node: PositionedNode, body: string): string => {
  const href = hrefOfNode(node);
  if (href === undefined || body === '') return body;
  return element('a', { href: href.startsWith('slide:') ? `#slide-${href.slice('slide:'.length)}` : href }, body);
};

const drawItem = (item: PaintItem, ctx: DrawContext): string => {
  const decoration = decorationSvg(item.node, ctx.loadImage, item.index);
  const content = dispatch(drawers, item.node, ctx, item.index);
  if (isNativeFrame(item.node)) return groupOf(item, decoration) + content;
  return linked(item.node, groupOf(item, decoration + content));
};

const BACKGROUND_CLIP_ID = 'clip-background';

/** Slide sem fundo é branco no PowerPoint/Keynote; o PNG não deve sair transparente. */
const DEFAULT_BACKGROUND = '#FFFFFF';

const backgroundSvg = (slide: PositionedSlide, area: Rect, ctx: DrawContext): string => {
  const background = slideBackgroundOf(slide.css);
  const base = backgroundColorSvg(area, typeof background === 'string' ? background : DEFAULT_BACKGROUND);
  if (background === undefined || typeof background === 'string') return base;
  return base + imageElementSvg(area, ctx.loadImage(background.image), 'cover', BACKGROUND_CLIP_ID);
};

// ───────────── debug ─────────────

/** Nó com o frame e a área de conteúdo do pai, para o realce de overflow. */
interface DebugItem {
  readonly node: PositionedNode;
  readonly parent: Rect;
  /** Área de conteúdo do pai (frame − borda − padding): limite da largura de um nowrap. */
  readonly parentContent: Rect;
  /** position="absolute" (ou dentro de um): decoração intencional, pode sair do pai. */
  readonly absolute: boolean;
}

const flatten = (
  nodes: readonly PositionedNode[],
  parent: PositionedSlide | PositionedNode,
  insideAbsolute: boolean,
): readonly DebugItem[] =>
  nodes.flatMap((node) => {
    const absolute = insideAbsolute || node.css.position === 'absolute';
    const children = node.kind === 'box' ? flatten(node.children, node, absolute) : [];
    return [{ node, parent: parent.frame, parentContent: contentRectOf(parent.frame, parent.box), absolute }, ...children];
  });

const outsideParentSvg = (item: DebugItem): string =>
  item.absolute ? '' : overflowRectsOf(item.node.frame, item.parent).map(overflowSvg).join('');

/** Largura disponível como no fit: em fluxo, a área de conteúdo cortada pela área de conteúdo do pai. */
const availableWidthOf = (content: Rect, absolute: boolean, parentContent: Rect): number => {
  if (absolute) return content.width;
  const right = Math.min(content.x + content.width, parentContent.x + parentContent.width);
  return Math.max(0, right - content.x);
};

const textBandsOf = (node: PositionedText, item: DebugItem): readonly Rect[] => {
  const content = contentOf(node);
  const available = availableWidthOf(content.frame, node.css.position === 'absolute', item.parentContent);
  return [textOverflowRectOf(content), textWidthOverflowRectOf(content, available)].filter((band): band is Rect => band !== undefined);
};

const tableBandsOf = (node: PositionedTable): readonly Rect[] => {
  const band = tableOverflowRectOf(contentOf(node));
  return band === undefined ? [] : [band];
};

const bandsOf = (item: DebugItem): readonly Rect[] => {
  const { node } = item;
  if (node.kind === 'text') return textBandsOf(node, item);
  if (node.kind === 'table') return tableBandsOf(node);
  return [];
};

/**
 * Texto que estoura a área de conteúdo (altura ou, com nowrap, largura) e tabela mais alta
 * que o frame ganham destaque sólido; os demais, o tracejado padrão.
 */
const debugOutlineOfItem = (item: DebugItem): string => {
  if (item.node.kind === 'shape') return '';
  const bands = bandsOf(item);
  return bands.length === 0 ? debugOutlineSvg(item.node.frame) : textOverflowSvg(item.node.frame, bands);
};

/** Debug fica por cima de tudo para não ser escondido por fills; frames sem rotação (os do layout). */
const debugSvg = (slide: PositionedSlide): string => {
  const items = flatten(slide.children, slide, false);
  return [...items.map(outsideParentSvg), ...items.map(debugOutlineOfItem)].join('');
};

export const slideToSvg = (slide: PositionedSlide, size: SlideSize, options: SvgOptions): string => {
  const ctx: DrawContext = {
    fontFamilyMap: options.fontFamilyMap,
    lang: options.lang,
    loadImage: (src) => loadImageUri(src, options.baseDir, options.readFile),
  };
  const area: Rect = { x: 0, y: 0, width: size.width, height: size.height };
  const body = [
    backgroundSvg(slide, area, ctx),
    ...paintOrderOf(slide).map((item) => drawItem(item, ctx)),
    ...(slide.connectors ?? []).map((connector) => connectorSvg(connector, { fontFamilyMap: ctx.fontFamilyMap })),
    options.debug ? debugSvg(slide) : '',
  ].join('');
  const root = attrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${size.width} ${size.height}`,
    width: options.widthPx,
    height: Math.round((options.widthPx * size.height) / size.width),
  });
  return `<svg${root}>${body}</svg>`;
};
