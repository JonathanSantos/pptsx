import type { Edges } from '../core/defaults.ts';
import type {
  Align,
  CssAlign,
  CssJustify,
  CssStyle,
  FlexDirection,
  Justify,
  Length,
  Len,
  PrimitiveKind,
  PrimitivePropsMap,
} from '../core/types.ts';
import type { Normalized } from './normalize.ts';

/**
 * "Visão da engine" das props (decisão M11 nº 5): o mesmo nó descrito com os nomes de
 * core/types.ts (direction, padding em pt, size, weight…). Fit, emissores e preview leem
 * essas chaves; o layout lê só `css`. As duas visões saem do mesmo `Normalized`, então não
 * divergem.
 */

const ALIGNS: Readonly<Record<CssAlign, Align>> = {
  'flex-start': 'start',
  center: 'center',
  'flex-end': 'end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFIES: Readonly<Record<CssJustify, Justify>> = {
  'flex-start': 'start',
  center: 'center',
  'flex-end': 'end',
  'space-between': 'between',
  'space-around': 'around',
  'space-evenly': 'evenly',
};

export const mainAxisOf = (css: CssStyle): FlexDirection => (css.flexDirection.startsWith('row') ? 'row' : 'column');

/** Padding em pt (o % só existe no layout; aqui vale 0, a área de conteúdo exata sai do frame). */
const ptEdges = (sides: CssStyle['padding']): Edges => ({
  top: typeof sides.top === 'number' ? sides.top : 0,
  right: typeof sides.right === 'number' ? sides.right : 0,
  bottom: typeof sides.bottom === 'number' ? sides.bottom : 0,
  left: typeof sides.left === 'number' ? sides.left : 0,
});

const compact = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

const lengthOf = (value: Len | undefined): Length | undefined => value;

/** Campos de item flex comuns (o fit lê position e height; a validação do Chart, width/height). */
const itemOf = (css: CssStyle) => ({
  position: css.position === 'static' ? undefined : css.position,
  width: lengthOf(css.width),
  height: lengthOf(css.height),
  minWidth: lengthOf(css.minWidth),
  maxWidth: lengthOf(css.maxWidth),
  minHeight: lengthOf(css.minHeight),
  maxHeight: lengthOf(css.maxHeight),
  grow: css.flexGrow > 0 ? css.flexGrow : undefined,
  shrink: css.flexShrink,
  alignSelf: css.alignSelf === undefined ? undefined : ALIGNS[css.alignSelf],
  top: css.inset.top,
  right: css.inset.right,
  bottom: css.inset.bottom,
  left: css.inset.left,
});

const containerOf = (css: CssStyle) => ({
  direction: mainAxisOf(css),
  gap: mainAxisOf(css) === 'row' ? css.columnGap : css.rowGap,
  padding: ptEdges(css.padding),
  align: ALIGNS[css.alignItems],
  justify: JUSTIFIES[css.justifyContent],
});

const slideBackgroundOf = (css: CssStyle) => {
  if (css.backgroundImage !== undefined) return { image: css.backgroundImage };
  return css.backgroundColor;
};

type LegacyBuilder = (normalized: Normalized) => Readonly<Record<string, unknown>>;

const textOf: LegacyBuilder = ({ css, text, own }) => ({
  ...itemOf(css),
  font: text.fontFamily,
  size: text.fontSize,
  weight: text.weight,
  italic: text.italic,
  color: text.color,
  lineHeight: text.lineHeight,
  align: text.textAlign,
  ...own,
});

const BUILDERS: Readonly<Record<PrimitiveKind, LegacyBuilder>> = {
  deck: () => ({}),
  span: () => ({}),
  slide: ({ css, own }) => ({ ...containerOf(css), background: slideBackgroundOf(css), ...own }),
  box: ({ css, own }) => ({ ...itemOf(css), ...containerOf(css), radius: css.borderRadius, ...own }),
  text: textOf,
  image: ({ css, own }) => ({ ...itemOf(css), ...own }),
  shape: ({ css, own }) => ({ ...itemOf(css), ...own }),
  // Gráfico herda família e cor dos rótulos; o size dos rótulos é próprio (padrão do gráfico), não o do texto.
  chart: ({ css, text, own }) => ({ ...itemOf(css), font: text.fontFamily, color: text.color, ...own }),
  table: ({ css, text, own }) => ({
    ...itemOf(css),
    font: text.fontFamily,
    size: text.fontSize,
    color: text.color,
    lineHeight: text.lineHeight,
    ...own,
  }),
  path: ({ css, own }) => ({ ...itemOf(css), ...own }),
  // Ícone herda a cor do texto (currentColor do CSS).
  icon: ({ css, text, own }) => ({ ...itemOf(css), color: text.color, ...own }),
  connector: ({ own }) => own,
  slideNumber: textOf,
};

export type LegacyProps<K extends PrimitiveKind> = Omit<PrimitivePropsMap[K], 'children'>;

// O único cast da visão da engine: os builders acima montam exatamente as chaves de PrimitivePropsMap[K].
export const legacyPropsOf = <K extends PrimitiveKind>(kind: K, normalized: Normalized): LegacyProps<K> =>
  compact(BUILDERS[kind](normalized)) as unknown as LegacyProps<K>;
