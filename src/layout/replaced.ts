import { Align as YogaAlign, Direction, Edge, FlexDirection as YogaFlexDirection, type Node as YogaNode } from 'yoga-layout';
import { DEFAULTS, PT_PER_PX } from '../core/defaults.ts';
import type { CssStyle, Dimensions, Len, ResolvedImage } from '../core/types.ts';
import { mainAxisOf } from './style.ts';
import type { BuiltNode } from './tree.ts';

/**
 * Imagem: tamanho usado pela tabela de restrições de elementos substituídos do CSS 2.1 §10.4
 * (min/max respeitados SEM perder a proporção). O Yoga prende cada eixo no seu min/max de
 * forma independente, o que distorce; e os percentuais só têm base depois do layout. Então,
 * como no contorno da baseline: layout, tamanho usado de cada imagem pela tabela (percentuais
 * resolvidos no bloco de contenção), width e height explícitos e layout de novo até estabilizar.
 * - width e height auto: o tentativo é o natural (px × 0,75; `aspectRatio` troca a proporção).
 *   É exatamente o browser.
 * - Só width (ou só height) do autor: o tentativo é esse eixo e o outro pela proporção, e a
 *   tabela também vale. Diferença intencional: o CSS 2.1 prenderia só o eixo derivado (caixa
 *   distorcida, figura salva pelo object-fit); o Yoga já transfere o min/max pela proporção
 *   quando o eixo derivado é o principal (Image numa column), e o grid e a row seguem a mesma
 *   regra para `width="100%" maxHeight="100%"` caber na célula sem distorcer.
 * - width e height do autor, ou grow: o autor (ou o flex) decide a caixa; o `fit` cuida da figura.
 */

/** Eixo que o autor fixou; o outro sai da proporção. */
type Given = 'none' | 'width' | 'height';

interface Constraints {
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

const hasRatio = (intrinsic: Dimensions | undefined): intrinsic is Dimensions =>
  intrinsic !== undefined && intrinsic.width > 0 && intrinsic.height > 0;

/** undefined = o tamanho não vem da proporção (as duas dimensões do autor, ou grow). */
const givenOf = (css: CssStyle): Given | undefined => {
  if (css.flexGrow > 0) return undefined;
  if (css.width === undefined) return css.height === undefined ? 'none' : 'height';
  return css.height === undefined ? 'width' : undefined;
};

const hasConstraints = (css: CssStyle): boolean =>
  [css.minWidth, css.maxWidth, css.minHeight, css.maxHeight].some((value) => value !== undefined);

const ratioOf = (css: CssStyle, intrinsic: Dimensions): number => css.aspectRatio ?? intrinsic.width / intrinsic.height;

/** Tamanho natural do conteúdo: px × 0,75; `aspectRatio` do autor substitui a proporção da imagem. */
export const naturalSizeOf = (css: CssStyle, intrinsic: Dimensions): Size => {
  const width = intrinsic.width * PT_PER_PX;
  return { width, height: width / ratioOf(css, intrinsic) };
};

/** Percentual sem base definida não restringe (CSS: max vira none, min vira 0). */
const resolveLen = (value: Len | undefined, base: number | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  if (typeof value === 'number') return value;
  if (base === undefined) return fallback;
  return (Number.parseFloat(value) / DEFAULTS.css.percentBase) * base;
};

/**
 * CSS 2.1 §10.4, a tabela inteira. `max` nunca abaixo de `min` (o min vence, como no CSS).
 * Tudo na caixa de conteúdo: é ela que tem a proporção.
 */
export const constrainedSizeOf = ({ width: w, height: h }: Size, c: Constraints): Size => {
  const maxW = Math.max(c.minWidth, c.maxWidth);
  const maxH = Math.max(c.minHeight, c.maxHeight);
  const { minWidth: minW, minHeight: minH } = c;
  const wide = w > maxW;
  const narrow = w < minW;
  const tall = h > maxH;
  const short = h < minH;
  if (wide && tall) {
    return maxW / w <= maxH / h
      ? { width: maxW, height: Math.max(minH, (maxW * h) / w) }
      : { width: Math.max(minW, (maxH * w) / h), height: maxH };
  }
  if (narrow && short) {
    return minW / w <= minH / h
      ? { width: Math.min(maxW, (minH * w) / h), height: minH }
      : { width: minW, height: Math.min(maxH, (minW * h) / w) };
  }
  if (narrow && tall) return { width: minW, height: maxH };
  if (wide && short) return { width: maxW, height: minH };
  if (wide) return { width: maxW, height: Math.max(minH, (maxW * h) / w) };
  if (narrow) return { width: minW, height: Math.min(maxH, (minW * h) / w) };
  if (tall) return { width: Math.max(minW, (maxH * w) / h), height: maxH };
  if (short) return { width: Math.min(maxW, (minH * w) / h), height: minH };
  return { width: w, height: h };
};

/** Contêiner na cadeia de ancestrais. A raiz (slide ou área isolada do grid) não tem nó resolvido. */
interface Ancestor {
  readonly yoga: YogaNode;
  readonly css?: CssStyle;
  readonly root: boolean;
}

interface ReplacedItem {
  readonly built: BuiltNode;
  readonly image: ResolvedImage;
  readonly intrinsic: Dimensions;
  readonly given: Given;
  /** Do pai para a raiz. */
  readonly ancestors: readonly Ancestor[];
}

const COLUMNS: ReadonlySet<YogaFlexDirection> = new Set([YogaFlexDirection.Column, YogaFlexDirection.ColumnReverse]);

const isBlock = (node: Ancestor): boolean => node.css?.display === 'block';

const isColumn = (node: Ancestor): boolean =>
  node.css === undefined ? COLUMNS.has(node.yoga.getFlexDirection()) : mainAxisOf(node.css) === 'column';

const stretchesChildren = (node: Ancestor): boolean =>
  node.css === undefined ? node.yoga.getAlignItems() === YogaAlign.Stretch : node.css.alignItems === 'stretch';

/**
 * Altura definida (CSS Sizing §4.1), na versão que o Yoga pratica: a raiz com altura, height
 * numérica (ou % de um pai definido), item que o flex dimensiona numa column definida, ou
 * item esticado numa row definida. Sem isso o max-height em % não tem base.
 */
const isDefiniteHeight = (chain: readonly Ancestor[], rootDefinite: boolean): boolean => {
  const [self, ...rest] = chain;
  if (self === undefined) return false;
  if (self.root || self.css === undefined) return rootDefinite;
  const { css } = self;
  if (typeof css.height === 'number') return true;
  const parent = rest[0];
  if (parent === undefined) return false;
  if (css.height !== undefined) return isDefiniteHeight(rest, rootDefinite);
  if (isBlock(parent)) return false;
  if (isColumn(parent)) return css.flexGrow > 0 && isDefiniteHeight(rest, rootDefinite);
  const stretched = css.alignSelf === undefined ? stretchesChildren(parent) : css.alignSelf === 'stretch';
  return stretched && isDefiniteHeight(rest, rootDefinite);
};

const contentOf = (yoga: YogaNode, withPadding: boolean): Size => {
  const inset = (a: Edge, b: Edge): number =>
    yoga.getComputedBorder(a) + yoga.getComputedBorder(b) + (withPadding ? yoga.getComputedPadding(a) + yoga.getComputedPadding(b) : 0);
  return {
    width: Math.max(0, yoga.getComputedWidth() - inset(Edge.Left, Edge.Right)),
    height: Math.max(0, yoga.getComputedHeight() - inset(Edge.Top, Edge.Bottom)),
  };
};

interface Containing {
  readonly width: number;
  /** undefined = altura indefinida: percentual de altura sem base. */
  readonly height: number | undefined;
}

/** Bloco de contenção: caixa de conteúdo do pai (de padding, para absoluto). */
const containingOf = (item: ReplacedItem, rootDefinite: boolean): Containing => {
  const block = contentOf(item.ancestors[0]!.yoga, item.image.css.position !== 'absolute');
  return { width: block.width, height: isDefiniteHeight(item.ancestors, rootDefinite) ? block.height : undefined };
};

const constraintsOf = (css: CssStyle, block: Containing): Constraints => ({
  minWidth: resolveLen(css.minWidth, block.width, 0),
  maxWidth: resolveLen(css.maxWidth, block.width, Number.POSITIVE_INFINITY),
  minHeight: resolveLen(css.minHeight, block.height, 0),
  maxHeight: resolveLen(css.maxHeight, block.height, Number.POSITIVE_INFINITY),
});

/** Tamanho tentativo do conteúdo (antes do min/max); undefined = eixo do autor sem base. */
const tentativeOf = (item: ReplacedItem, block: Containing, horizontal: number, vertical: number): Size | undefined => {
  const { css } = item.image;
  const ratio = ratioOf(css, item.intrinsic);
  if (item.given === 'none') return naturalSizeOf(css, item.intrinsic);
  if (item.given === 'width') {
    const width = Math.max(0, resolveLen(css.width, block.width, Number.NaN) - horizontal);
    return Number.isNaN(width) ? undefined : { width, height: width / ratio };
  }
  const height = Math.max(0, resolveLen(css.height, block.height, Number.NaN) - vertical);
  return Number.isNaN(height) ? undefined : { width: height * ratio, height };
};

/** min/max são do border-box (box-sizing do Yoga); a tabela roda na caixa de conteúdo. */
const contentConstraints = (c: Constraints, horizontal: number, vertical: number): Constraints => ({
  minWidth: Math.max(0, c.minWidth - horizontal),
  maxWidth: Math.max(0, c.maxWidth - horizontal),
  minHeight: Math.max(0, c.minHeight - vertical),
  maxHeight: Math.max(0, c.maxHeight - vertical),
});

const correct = (item: ReplacedItem, rootDefinite: boolean): boolean => {
  const { yoga } = item.built;
  const horizontal = yoga.getComputedWidth() - contentOf(yoga, true).width;
  const vertical = yoga.getComputedHeight() - contentOf(yoga, true).height;
  const block = containingOf(item, rootDefinite);
  const tentative = tentativeOf(item, block, horizontal, vertical);
  if (tentative === undefined) return false;
  const used = constrainedSizeOf(tentative, contentConstraints(constraintsOf(item.image.css, block), horizontal, vertical));
  const width = used.width + horizontal;
  const height = used.height + vertical;
  const noise = DEFAULTS.css.layoutNoise;
  const current = { width: yoga.getWidth().value, height: yoga.getHeight().value };
  if (Math.abs(current.width - width) <= noise && Math.abs(current.height - height) <= noise) return false;
  yoga.setWidth(width);
  yoga.setHeight(height);
  return true;
};

const replacedItemsOf = (nodes: readonly BuiltNode[], ancestors: readonly Ancestor[]): readonly ReplacedItem[] =>
  nodes.flatMap((built) => {
    const { source } = built;
    if (source.kind === 'box') return replacedItemsOf(built.children, [{ yoga: built.yoga, css: source.css, root: false }, ...ancestors]);
    if (source.kind !== 'image' || !hasRatio(built.intrinsic) || !hasConstraints(source.css)) return [];
    const given = givenOf(source.css);
    return given === undefined ? [] : [{ built, image: source, intrinsic: built.intrinsic, given, ancestors }];
  });

/**
 * Relayout até o tamanho usado de cada imagem estabilizar. Cada correção pode mudar o bloco
 * de contenção de outra (pai com altura pelo conteúdo), então uma rodada por imagem basta.
 */
export const settleReplaced = (
  root: YogaNode,
  children: readonly BuiltNode[],
  size: { readonly width: number | undefined; readonly height: number | undefined },
  rootCss?: CssStyle,
): void => {
  const items = replacedItemsOf(children, [{ yoga: root, css: rootCss, root: true }]);
  const rootDefinite = size.height !== undefined;
  const settle = (remaining: number): void => {
    if (remaining <= 0) return;
    const changed = items.map((item) => correct(item, rootDefinite)).some(Boolean);
    if (!changed) return;
    root.calculateLayout(size.width, size.height, Direction.LTR);
    settle(remaining - 1);
  };
  settle(items.length + 1);
};
