import type {
  Align,
  ContainerProps,
  FitPolicy,
  FlexDirection,
  ImageFit,
  ImageProps,
  Justify,
  Pt,
  Spacing,
  TextAlign,
  TextProps,
  TextStyle,
} from './types.ts';

/**
 * Padrões únicos da engine. Os módulos nunca repetem esses valores:
 * importam daqui ou usam os helpers abaixo.
 */
export const DEFAULTS = {
  text: {
    font: 'Arial',
    size: 18,
    weight: 'regular',
    italic: false,
    color: '#000000',
    lineHeight: 1,
    align: 'left' as TextAlign,
    fit: 'shrink' as FitPolicy,
    /** minSize = floor(size * minSizeRatio) quando não informado */
    minSizeRatio: 0.75,
  },
  container: {
    direction: 'column' as FlexDirection,
    gap: 0,
    padding: 0,
    align: 'stretch' as Align,
    justify: 'start' as Justify,
  },
  strokeWidth: 1,
  imageFit: 'contain' as ImageFit,
  /** Largura de quebra = disponível * textSafety; a caixa sai com a largura cheia. */
  textSafety: 0.97,
  maxFitIterations: 12,
  /** 16:9 de referência para ctx.scale */
  referenceSize: { width: 720, height: 405 },
  preview: { width: 1280, thumbWidth: 320, overviewColumns: 4 },
} as const;

export const PT_PER_INCH = 72;

export const textStyleOf = (props: TextProps): TextStyle => ({
  family: props.font ?? DEFAULTS.text.font,
  size: props.size ?? DEFAULTS.text.size,
  weight: props.weight ?? DEFAULTS.text.weight,
  italic: props.italic ?? DEFAULTS.text.italic,
  lineHeight: props.lineHeight ?? DEFAULTS.text.lineHeight,
});

export const fitPolicyOf = (props: TextProps): FitPolicy => props.fit ?? DEFAULTS.text.fit;

export const minSizeOf = (props: TextProps): Pt =>
  props.minSize ?? Math.floor((props.size ?? DEFAULTS.text.size) * DEFAULTS.text.minSizeRatio);

export const imageFitOf = (props: ImageProps): ImageFit => props.fit ?? DEFAULTS.imageFit;

export interface Edges {
  readonly top: Pt;
  readonly right: Pt;
  readonly bottom: Pt;
  readonly left: Pt;
}

export const edgesOf = (spacing: Spacing | undefined): Edges => {
  if (spacing === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof spacing === 'number') return { top: spacing, right: spacing, bottom: spacing, left: spacing };
  return { top: spacing.top ?? 0, right: spacing.right ?? 0, bottom: spacing.bottom ?? 0, left: spacing.left ?? 0 };
};

export const containerOf = (props: ContainerProps) => ({
  direction: props.direction ?? DEFAULTS.container.direction,
  gap: props.gap ?? DEFAULTS.container.gap,
  padding: edgesOf(props.padding),
  align: props.align ?? DEFAULTS.container.align,
  justify: props.justify ?? DEFAULTS.container.justify,
});
