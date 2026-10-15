/**
 * M11: `css` e `box` dos nós literais dos testes. Os helpers de nodes.ts continuam recebendo as
 * props da engine (direction, gap, fill, radius…) e derivam daqui o `css` equivalente, com o
 * mesmo de/para dos aliases do resolve (CONTRACTS §M11 "Aliases antigos"). Local de propósito:
 * os ~70 arquivos de teste não dependem da implementação do resolve para montar um nó.
 * tests/resolve/css-helper.test.tsx confere que isto bate com `initialCss` e com o resolve real.
 */
import { DEFAULTS } from '../../src/core/defaults.ts';
import type {
  Align,
  BorderSide,
  BoxMetrics,
  CssAlign,
  CssJustify,
  CssStyle,
  Display,
  FlexItemProps,
  GridPlacement,
  Justify,
  Len,
  PrimitiveKind,
  Sides,
  Spacing,
} from '../../src/core/types.ts';

const NO_BORDER: BorderSide = { width: 0, style: 'none', color: DEFAULTS.text.color, alpha: 1 };
const AUTO: GridPlacement = { start: { kind: 'auto' }, end: { kind: 'auto' } };
const ZERO_SIDES: Sides<number> = { top: 0, right: 0, bottom: 0, left: 0 };

/** O `CssStyle` de um nó sem props (Box/Slide: flex column; folhas: block). */
const baseCss = (display: Display): CssStyle => ({
  display,
  position: 'static',
  inset: {},
  flexDirection: DEFAULTS.css.legacyDirection,
  flexWrap: 'nowrap',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'stretch',
  flexGrow: DEFAULTS.css.flexGrow,
  flexShrink: DEFAULTS.css.flexShrink,
  flexBasis: 'auto',
  basisSource: 'none',
  order: DEFAULTS.css.order,
  rowGap: 0,
  columnGap: 0,
  margin: ZERO_SIDES,
  padding: ZERO_SIDES,
  border: { top: NO_BORDER, right: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER },
  backgroundAlpha: 1,
  opacity: DEFAULTS.css.opacity,
  rotate: 0,
  translate: { x: 0, y: 0 },
  overflow: 'visible',
  gridColumn: AUTO,
  gridRow: AUTO,
  textDecoration: { underline: false, lineThrough: false },
  letterSpacing: 0,
  textTransform: 'none',
  notEmitted: [],
});

/** `CssStyle` inicial (como `initialCss()` do resolve) com sobrescritas. */
export const cssOf = (overrides: Partial<CssStyle> = {}): CssStyle => ({ ...baseCss(DEFAULTS.css.boxDisplay), ...overrides });

const ALIGNS: Readonly<Record<Align, CssAlign>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFIES: Readonly<Record<Justify, CssJustify>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const sidesOf = (spacing: Spacing | undefined): Sides<number> => {
  if (spacing === undefined) return ZERO_SIDES;
  if (typeof spacing === 'number') return { top: spacing, right: spacing, bottom: spacing, left: spacing };
  return { top: spacing.top ?? 0, right: spacing.right ?? 0, bottom: spacing.bottom ?? 0, left: spacing.left ?? 0 };
};

/** Só as chaves definidas (o CssStyle distingue "ausente" de valor). */
const defined = <T extends object>(record: T): Partial<T> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Partial<T>;

/** Props da engine que qualquer primitiva aceita, lidas como os helpers as recebem. */
type EngineProps = FlexItemProps & {
  readonly direction?: 'row' | 'column';
  readonly gap?: number;
  readonly padding?: Spacing;
  readonly align?: Align;
  readonly justify?: Justify;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly radius?: number;
  readonly background?: string | { readonly image: string };
};

const itemCss = (props: EngineProps): Partial<CssStyle> =>
  defined({
    position: props.position,
    inset: defined({ top: props.top, right: props.right, bottom: props.bottom, left: props.left }) as Partial<Sides<Len>>,
    width: props.width,
    height: props.height,
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    flexGrow: props.grow,
    basisSource: props.grow === undefined ? undefined : ('flex' as const),
    flexBasis: props.grow === undefined ? undefined : 0,
    flexShrink: props.shrink,
    alignSelf: props.alignSelf === undefined ? undefined : ALIGNS[props.alignSelf],
  });

const containerCss = (props: EngineProps): Partial<CssStyle> =>
  defined({
    flexDirection: props.direction,
    rowGap: props.gap,
    columnGap: props.gap,
    padding: props.padding === undefined ? undefined : sidesOf(props.padding),
    alignItems: props.align === undefined ? undefined : ALIGNS[props.align],
    justifyContent: props.justify === undefined ? undefined : JUSTIFIES[props.justify],
  });

// Box: fill/stroke/radius são aliases de backgroundColor/outline/borderRadius (no Shape são da forma).
const boxPaintCss = (props: EngineProps): Partial<CssStyle> =>
  defined({
    backgroundColor: props.fill,
    borderRadius: props.radius,
    outline:
      props.stroke === undefined && props.strokeWidth === undefined
        ? undefined
        : { color: props.stroke ?? DEFAULTS.lineStroke, width: props.strokeWidth ?? DEFAULTS.strokeWidth },
  });

const slideBackgroundCss = (background: EngineProps['background']): Partial<CssStyle> => {
  if (background === undefined) return {};
  return typeof background === 'string' ? { backgroundColor: background } : { backgroundImage: background.image };
};

/** O `css` que o resolve daria para um nó escrito com estas props da engine (sem herança de texto). */
export const legacyCssOf = (kind: PrimitiveKind, props: object = {}): CssStyle => {
  const engine = props as EngineProps;
  if (kind === 'slide') return { ...baseCss('flex'), ...containerCss(engine), ...slideBackgroundCss(engine.background) };
  if (kind === 'box') return { ...baseCss('flex'), ...itemCss(engine), ...containerCss(engine), ...boxPaintCss(engine) };
  return { ...baseCss('block'), ...itemCss(engine) };
};

/** Margem, borda e padding do nó posicionado como o layout resolveria a partir do `css` (sem %). */
export const boxOf = (css?: CssStyle): BoxMetrics => {
  if (css === undefined) return { margin: ZERO_SIDES, border: ZERO_SIDES, padding: ZERO_SIDES };
  const pt = (value: unknown): number => (typeof value === 'number' ? value : 0);
  const sides = (pick: (side: keyof Sides<unknown>) => unknown): Sides<number> => ({
    top: pt(pick('top')),
    right: pt(pick('right')),
    bottom: pt(pick('bottom')),
    left: pt(pick('left')),
  });
  return {
    margin: sides((side) => css.margin[side]),
    border: sides((side) => css.border[side].width),
    padding: sides((side) => css.padding[side]),
  };
};

const ITEM_KEYS = ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'grow', 'shrink', 'alignSelf', 'position', 'top', 'right', 'bottom', 'left'] as const;
const CONTAINER_KEYS = ['direction', 'gap', 'padding', 'align', 'justify'] as const;

/** Chaves de geometria que, por primitiva, vão só para o `css` (M16: as props do nó não as repetem). */
const GEOMETRY_KEYS: Readonly<Partial<Record<PrimitiveKind, readonly string[]>>> = {
  slide: [...CONTAINER_KEYS, 'background'],
  // No Box, fill/stroke/radius são aliases de CSS (no Shape são da forma e ficam).
  box: [...ITEM_KEYS, ...CONTAINER_KEYS, 'fill', 'stroke', 'strokeWidth', 'radius'],
};

/** As props do nó como o resolve entrega: sem a geometria, que o helper já pôs no `css`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodePropsOf = <P extends object>(kind: PrimitiveKind, props: P): any => {
  const keys = new Set(GEOMETRY_KEYS[kind] ?? ITEM_KEYS);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !keys.has(key)));
};
