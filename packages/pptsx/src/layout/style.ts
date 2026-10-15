import {
  Align as YogaAlign,
  FlexDirection as YogaFlexDirection,
  Justify as YogaJustify,
  PositionType,
  Wrap,
} from 'yoga-layout';
import { PT_PER_PX } from '../core/defaults.ts';
import type {
  CssAlign,
  CssAlignContent,
  CssFlexDirection,
  CssFlexWrap,
  CssJustify,
  CssStyle,
  Dimensions,
  FlexDirection,
  Len,
  MarginLen,
  Sides,
} from '../core/types.ts';

/**
 * CSS normalizado → descrição declarativa do nó Yoga (separada da aplicação, testável sem
 * criar nós). Box-sizing é sempre border-box, que é o modelo do Yoga.
 */
export interface YogaStyle {
  readonly flexDirection?: YogaFlexDirection;
  readonly flexWrap?: Wrap;
  readonly justifyContent?: YogaJustify;
  readonly alignItems?: YogaAlign;
  readonly alignContent?: YogaAlign;
  readonly alignSelf?: YogaAlign;
  readonly rowGap?: number;
  readonly columnGap?: number;
  readonly padding?: Partial<Sides<Len>>;
  readonly border?: Partial<Sides<number>>;
  readonly margin?: Partial<Sides<MarginLen>>;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly flexBasis?: Len | 'auto';
  readonly width?: Len;
  readonly height?: Len;
  readonly minWidth?: Len;
  readonly maxWidth?: Len;
  readonly minHeight?: Len;
  readonly maxHeight?: Len;
  readonly positionType?: PositionType;
  readonly position?: Partial<Sides<Len>>;
  readonly aspectRatio?: number;
}

const DIRECTIONS: Readonly<Record<CssFlexDirection, YogaFlexDirection>> = {
  row: YogaFlexDirection.Row,
  column: YogaFlexDirection.Column,
  'row-reverse': YogaFlexDirection.RowReverse,
  'column-reverse': YogaFlexDirection.ColumnReverse,
};

const WRAPS: Readonly<Record<CssFlexWrap, Wrap>> = {
  nowrap: Wrap.NoWrap,
  wrap: Wrap.Wrap,
  'wrap-reverse': Wrap.WrapReverse,
};

const ALIGNS: Readonly<Record<CssAlign, YogaAlign>> = {
  'flex-start': YogaAlign.FlexStart,
  center: YogaAlign.Center,
  'flex-end': YogaAlign.FlexEnd,
  stretch: YogaAlign.Stretch,
  baseline: YogaAlign.Baseline,
};

const JUSTIFIES: Readonly<Record<CssJustify, YogaJustify>> = {
  'flex-start': YogaJustify.FlexStart,
  center: YogaJustify.Center,
  'flex-end': YogaJustify.FlexEnd,
  'space-between': YogaJustify.SpaceBetween,
  'space-around': YogaJustify.SpaceAround,
  'space-evenly': YogaJustify.SpaceEvenly,
};

const ALIGN_CONTENTS: Readonly<Record<CssAlignContent, YogaAlign>> = {
  'flex-start': YogaAlign.FlexStart,
  center: YogaAlign.Center,
  'flex-end': YogaAlign.FlexEnd,
  stretch: YogaAlign.Stretch,
  'space-between': YogaAlign.SpaceBetween,
  'space-around': YogaAlign.SpaceAround,
  'space-evenly': YogaAlign.SpaceEvenly,
};

/** Eixo principal do contêiner (o reverse não muda o eixo). */
export const mainAxisOf = (css: CssStyle): FlexDirection => (css.flexDirection.startsWith('row') ? 'row' : 'column');

/** Baseline só tem sentido entre itens lado a lado; numa column vira start (contrato M8). */
const alignOf = (align: CssAlign, direction: FlexDirection): YogaAlign =>
  align === 'baseline' && direction === 'column' ? YogaAlign.FlexStart : ALIGNS[align];

/** O que o item precisa saber do pai para virar estilo Yoga. */
export interface ParentLayout {
  /** Eixo principal do pai. */
  readonly direction: FlexDirection;
  readonly display: CssStyle['display'];
  readonly alignItems: CssAlign;
  /** A baseline do pai é lida por um ancestral (então a dos filhos também importa). */
  readonly baseline: boolean;
}

const borderWidths = (css: CssStyle): Sides<number> => ({
  top: css.border.top.width,
  right: css.border.right.width,
  bottom: css.border.bottom.width,
  left: css.border.left.width,
});

/** Caixa (padding + borda) de qualquer nó: no CSS todo elemento tem box model, inclusive Text e Image. */
export const toBoxStyle = (css: CssStyle): YogaStyle => ({ padding: css.padding, border: borderWidths(css) });

/** Contêiner block: coluna esticada, sem gap e sem shrink nos filhos (margens colapsam no tree.ts). */
const BLOCK: YogaStyle = {
  flexDirection: YogaFlexDirection.Column,
  flexWrap: Wrap.NoWrap,
  justifyContent: YogaJustify.FlexStart,
  alignItems: YogaAlign.Stretch,
  alignContent: YogaAlign.FlexStart,
  rowGap: 0,
  columnGap: 0,
};

export const toContainerStyle = (css: CssStyle): YogaStyle => {
  if (css.display === 'block') return { ...toBoxStyle(css), ...BLOCK };
  const direction = mainAxisOf(css);
  return {
    ...toBoxStyle(css),
    flexDirection: DIRECTIONS[css.flexDirection],
    flexWrap: WRAPS[css.flexWrap],
    justifyContent: JUSTIFIES[css.justifyContent],
    alignItems: alignOf(css.alignItems, direction),
    alignContent: ALIGN_CONTENTS[css.alignContent],
    rowGap: css.rowGap,
    columnGap: css.columnGap,
  };
};


/**
 * flex-basis conforme a origem (ver BasisSource em types.ts). Text/Table numa column não
 * recebem basis 0: o Yoga não tem o min-height:auto do browser, e basis 0 com shrink zeraria
 * a altura do texto (regra desde o M5-F).
 */
const flexBasisOf = (css: CssStyle, parent: ParentLayout, contentLeaf: boolean): Len | 'auto' | undefined => {
  const contentInColumn = contentLeaf && parent.direction === 'column';
  switch (css.basisSource) {
    case 'none':
      return undefined;
    case 'author':
      return css.flexBasis;
    case 'flex':
      return contentInColumn ? undefined : css.flexBasis;
  }
};

const POSITION_TYPES: Readonly<Record<CssStyle['position'], PositionType>> = {
  // static vira relative no Yoga: o bloco de contenção do absoluto é sempre o pai (como antes
  // e o React Native); a diferença para o CSS é só essa, e o offset de static é ignorado abaixo.
  static: PositionType.Relative,
  relative: PositionType.Relative,
  absolute: PositionType.Absolute,
};

const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

const hasKeys = (value: object): boolean => Object.keys(value).length > 0;

/** Item de flex (ou de block): o eixo principal é o do PAI. */
export const toItemStyle = (css: CssStyle, parent: ParentLayout, contentLeaf: boolean = false): YogaStyle => {
  const inset = css.position === 'static' ? {} : compact(css.inset);
  return compact({
    flexGrow: css.flexGrow,
    // Em block os filhos não encolhem: a altura é o conteúdo (o estouro é do contêiner).
    flexShrink: parent.display === 'block' ? 0 : css.flexShrink,
    flexBasis: flexBasisOf(css, parent, contentLeaf),
    width: css.width,
    height: css.height,
    minWidth: css.minWidth,
    maxWidth: css.maxWidth,
    minHeight: css.minHeight,
    maxHeight: css.maxHeight,
    aspectRatio: css.aspectRatio,
    alignSelf: css.alignSelf === undefined ? undefined : alignOf(css.alignSelf, parent.direction),
    positionType: POSITION_TYPES[css.position],
    position: hasKeys(inset) ? inset : undefined,
    margin: css.margin,
  });
};

/**
 * O pai lê a baseline deste item: alinhado por baseline numa row, ou dentro de um Box cuja
 * baseline já é lida (a baseline do Box é a do 1º filho, recursivamente).
 */
export const readsBaseline = (css: CssStyle, parent: ParentLayout): boolean =>
  parent.baseline || (parent.direction === 'row' && parent.display !== 'block' && (css.alignSelf ?? parent.alignItems) === 'baseline');

/** nowrap numa row: o Yoga não pode espremer a caixa abaixo da linha (o fit vê o estouro). */
export const withLineMinWidth = (style: YogaStyle, lineWidth: number): YogaStyle => {
  const author = style.minWidth;
  return { ...style, minWidth: typeof author === 'number' ? Math.max(author, lineWidth) : lineWidth };
};

/**
 * Imagem: com as duas dimensões, nada a fazer; com uma, a outra vem da proporção; com grow,
 * o flex decide a caixa; sem nada, tamanho natural (px × 0,75).
 */
export const toImageStyle = (css: CssStyle, intrinsic: Dimensions, parent: ParentLayout): YogaStyle => {
  const item = { ...toItemStyle(css, parent), ...toBoxStyle(css) };
  const hasWidth = css.width !== undefined;
  const hasHeight = css.height !== undefined;
  if (hasWidth && hasHeight) return item;
  if (intrinsic.width <= 0 || intrinsic.height <= 0) return item;
  const aspectRatio = css.aspectRatio ?? intrinsic.width / intrinsic.height;
  if (hasWidth || hasHeight) return { ...item, aspectRatio };
  if (css.flexGrow > 0) return item;
  return { ...item, width: intrinsic.width * PT_PER_PX, height: intrinsic.height * PT_PER_PX };
};
