import {
  Align as YogaAlign,
  FlexDirection as YogaFlexDirection,
  Justify as YogaJustify,
  PositionType,
} from 'yoga-layout';
import { DEFAULTS, PT_PER_INCH, containerOf, type Edges } from '../core/defaults.ts';
import type {
  Align,
  ContainerProps,
  Dimensions,
  FlexDirection,
  FlexItemProps,
  ImageProps,
  Justify,
  Length,
} from '../core/types.ts';

/**
 * Descrição declarativa do estilo de um nó Yoga. Separada da aplicação
 * para que o mapeamento props → Yoga seja testável sem criar nós.
 */
export interface YogaStyle {
  readonly flexDirection?: YogaFlexDirection;
  readonly gap?: number;
  readonly padding?: Edges;
  readonly alignItems?: YogaAlign;
  readonly justifyContent?: YogaJustify;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly flexBasis?: number;
  readonly width?: Length;
  readonly height?: Length;
  readonly minWidth?: Length;
  readonly maxWidth?: Length;
  readonly minHeight?: Length;
  readonly maxHeight?: Length;
  readonly alignSelf?: YogaAlign;
  readonly positionType?: PositionType;
  readonly position?: Partial<Record<keyof Edges, Length>>;
  readonly aspectRatio?: number;
}

const DIRECTIONS: Readonly<Record<FlexDirection, YogaFlexDirection>> = {
  row: YogaFlexDirection.Row,
  column: YogaFlexDirection.Column,
};

const ALIGNS: Readonly<Record<Align, YogaAlign>> = {
  start: YogaAlign.FlexStart,
  center: YogaAlign.Center,
  end: YogaAlign.FlexEnd,
  stretch: YogaAlign.Stretch,
};

const JUSTIFIES: Readonly<Record<Justify, YogaJustify>> = {
  start: YogaJustify.FlexStart,
  center: YogaJustify.Center,
  end: YogaJustify.FlexEnd,
  between: YogaJustify.SpaceBetween,
  around: YogaJustify.SpaceAround,
  evenly: YogaJustify.SpaceEvenly,
};

const POSITION_TYPES: Readonly<Record<NonNullable<FlexItemProps['position']>, PositionType>> = {
  relative: PositionType.Relative,
  absolute: PositionType.Absolute,
};

// Imagens trazem tamanho em px CSS (96 por polegada); o natural em pt é px × 0.75.
const CSS_PX_PER_INCH = 96;
const PT_PER_PX = PT_PER_INCH / CSS_PX_PER_INCH;

/** Remove chaves com valor `undefined` para a descrição só conter o que o autor pediu. */
const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

const positionOf = (props: FlexItemProps): YogaStyle['position'] => {
  const position = compact({ top: props.top, right: props.right, bottom: props.bottom, left: props.left });
  return Object.keys(position).length > 0 ? position : undefined;
};

/** Contêiner sempre recebe os padrões explícitos (Yoga tem padrões próprios diferentes dos nossos). */
export const toContainerStyle = (props: ContainerProps): YogaStyle => {
  const container = containerOf(props);
  return {
    flexDirection: DIRECTIONS[container.direction],
    gap: container.gap,
    padding: container.padding,
    alignItems: ALIGNS[container.align],
    justifyContent: JUSTIFIES[container.justify],
  };
};

const MAIN_SIZE: Readonly<Record<FlexDirection, 'width' | 'height'>> = {
  row: 'width',
  column: 'height',
};

// grow sem tamanho no eixo principal = `flex: n` do CSS: irmãos com o mesmo grow ficam iguais.
const flexBasisOf = (props: FlexItemProps, parentDirection: FlexDirection): number | undefined => {
  if (props.grow === undefined || props.grow <= 0) return undefined;
  if (props[MAIN_SIZE[parentDirection]] !== undefined) return undefined;
  return DEFAULTS.item.growBasis;
};

/** O eixo principal é o do PAI, por isso a direção dele entra no mapeamento. */
export const toItemStyle = (props: FlexItemProps, parentDirection: FlexDirection): YogaStyle =>
  compact({
    flexGrow: props.grow,
    flexShrink: props.shrink ?? DEFAULTS.item.shrink,
    flexBasis: flexBasisOf(props, parentDirection),
    width: props.width,
    height: props.height,
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    alignSelf: props.alignSelf === undefined ? undefined : ALIGNS[props.alignSelf],
    positionType: props.position === undefined ? undefined : POSITION_TYPES[props.position],
    position: positionOf(props),
  });

/** Box: item flex e contêiner ao mesmo tempo. */
export const toYogaStyle = (props: FlexItemProps & ContainerProps, parentDirection: FlexDirection): YogaStyle => ({
  ...toItemStyle(props, parentDirection),
  ...toContainerStyle(props),
});

/**
 * Tamanho da imagem: com as duas dimensões, nada a fazer; com uma, a outra vem da
 * proporção; com grow, o flex decide a caixa (o fit cuida da proporção); sem
 * nada, tamanho natural.
 */
export const toImageStyle = (
  props: ImageProps,
  intrinsic: Dimensions,
  parentDirection: FlexDirection,
): YogaStyle => {
  const item = toItemStyle(props, parentDirection);
  const hasWidth = props.width !== undefined;
  const hasHeight = props.height !== undefined;
  if (hasWidth && hasHeight) return item;
  if (intrinsic.width <= 0 || intrinsic.height <= 0) return item;
  const aspectRatio = intrinsic.width / intrinsic.height;
  if (hasWidth || hasHeight) return { ...item, aspectRatio };
  // Com grow o flex define a caixa inteira; travar a proporção tornaria contain e cover idênticos.
  if (props.grow !== undefined) return item;
  return { ...item, width: intrinsic.width * PT_PER_PX, height: intrinsic.height * PT_PER_PX };
};
