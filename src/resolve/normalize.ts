import { DEFAULTS } from '../core/defaults.ts';
import type { BorderSide, CssFlexDirection, CssStyle, Display, GridPlacement, Len, MarginLen, PrimitiveKind, Sides } from '../core/types.ts';
import { KIND_HANDLERS } from './alias-handlers.ts';
import { BOX_HANDLERS } from './box-handlers.ts';
import { EMPTY_DRAFT, reject } from './draft.ts';
import type { BorderDraft, Draft, Handler, InheritedText } from './draft.ts';
import { OUTLINE_HANDLERS } from './outline.ts';
import { PAINT_HANDLERS } from './paint-handlers.ts';
import { TEXT_HANDLERS } from './text-handlers.ts';

/**
 * Normalização de um nó: props do autor (já sem responsivo) → `CssStyle` (sem shorthands,
 * nomes antigos convertidos) + o estilo de texto que desce para os filhos (herança).
 */

const CSS_HANDLERS: Readonly<Record<string, Handler>> = { ...BOX_HANDLERS, ...PAINT_HANDLERS, ...OUTLINE_HANDLERS, ...TEXT_HANDLERS };

// Escape: chaves que não são CSS nem da primitiva. Não tem de/para → diagnóstico.
const unknownHandler: Handler = (draft, value, key) => reject(draft, key, value, 'propriedade sem de/para para o PPTX');

/** Shorthands antes das longhands: `marginTop` vence `margin` qualquer que seja a ordem no objeto. */
const SHORTHANDS: ReadonlySet<string> = new Set([
  'margin',
  'padding',
  'inset',
  'border',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'flex',
  'gap',
  'placeItems',
  'placeSelf',
  'background',
  'outline',
  'gridColumn',
  'gridRow',
]);

const priorityOf = (key: string): number => (SHORTHANDS.has(key) ? 0 : 1);

const handlerOf = (kind: PrimitiveKind, key: string): Handler => KIND_HANDLERS[kind][key] ?? CSS_HANDLERS[key] ?? unknownHandler;

type Entry = readonly [string, unknown];

/** Merge do `style` sobre as props (o que está em style vence, como inline style). */
const entriesOf = (props: Readonly<Record<string, unknown>>): readonly Entry[] => {
  const { style, ...rest } = props;
  const styleEntries = typeof style === 'object' && style !== null ? Object.entries(style) : [];
  const merged = new Map<string, unknown>([...Object.entries(rest), ...styleEntries]);
  return [...merged].filter(([, value]) => value !== undefined).sort(([a], [b]) => priorityOf(a) - priorityOf(b));
};

const draftOf = (kind: PrimitiveKind, props: Readonly<Record<string, unknown>>): Draft =>
  entriesOf(props).reduce((draft, [key, value]) => handlerOf(kind, key)(draft, value, key), EMPTY_DRAFT);

// ───────────────────────── finalização ─────────────────────────

const NO_BORDER: BorderSide = { width: 0, style: 'none', color: DEFAULTS.text.color, alpha: 1 };

const borderSideOf = (draft: BorderDraft | undefined, currentColor: string): BorderSide => {
  if (draft === undefined) return NO_BORDER;
  const style = draft.style ?? 'none';
  const width = style === 'none' ? 0 : (draft.width ?? DEFAULTS.css.borderMediumWidth);
  return { width, style, color: draft.color ?? currentColor, alpha: draft.alpha ?? 1 };
};

const sidesWith = <T>(partial: Partial<Sides<T>>, fallback: T): Sides<T> => ({
  top: partial.top ?? fallback,
  right: partial.right ?? fallback,
  bottom: partial.bottom ?? fallback,
  left: partial.left ?? fallback,
});

const AUTO_PLACEMENT: GridPlacement = { start: { kind: 'auto' }, end: { kind: 'auto' } };

/** Direção padrão: Slide e Box sem display são column (decisão M11 nº 3); `display: flex` explícito é row (CSS). */
const defaultDirectionOf = (kind: PrimitiveKind, draft: Draft): CssFlexDirection =>
  kind === 'box' && draft.display === 'flex' ? DEFAULTS.css.cssFlexDirection : DEFAULTS.css.legacyDirection;

const displayOf = (kind: PrimitiveKind, draft: Draft): Display => {
  if (draft.display !== undefined) return draft.display;
  return kind === 'box' || kind === 'slide' ? DEFAULTS.css.boxDisplay : 'block';
};

/** Campo opcional só quando definido (o CssStyle distingue "ausente" de valor). */
const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

const finalize = (kind: PrimitiveKind, draft: Draft, currentColor: string): CssStyle => ({
  display: displayOf(kind, draft),
  position: draft.position ?? 'static',
  inset: draft.inset,
  ...draft.sizes,
  ...optional('aspectRatio', draft.aspectRatio),
  flexDirection: draft.flexDirection ?? defaultDirectionOf(kind, draft),
  flexWrap: draft.flexWrap ?? 'nowrap',
  justifyContent: draft.justifyContent ?? 'flex-start',
  alignItems: draft.alignItems ?? 'stretch',
  alignContent: draft.alignContent ?? 'stretch',
  ...optional('alignSelf', draft.alignSelf),
  ...optional('justifySelf', draft.justifySelf),
  ...optional('justifyItems', draft.justifyItems),
  flexGrow: draft.flexGrow ?? DEFAULTS.css.flexGrow,
  flexShrink: draft.flexShrink ?? DEFAULTS.css.flexShrink,
  flexBasis: draft.flexBasis ?? 'auto',
  basisSource: draft.basisSource,
  order: draft.order ?? DEFAULTS.css.order,
  rowGap: draft.rowGap ?? 0,
  columnGap: draft.columnGap ?? 0,
  margin: sidesWith<MarginLen>(draft.margin, 0),
  padding: sidesWith<Len>(draft.padding, 0),
  border: {
    top: borderSideOf(draft.border.top, currentColor),
    right: borderSideOf(draft.border.right, currentColor),
    bottom: borderSideOf(draft.border.bottom, currentColor),
    left: borderSideOf(draft.border.left, currentColor),
  },
  ...optional('borderRadius', draft.borderRadius),
  ...optional('backgroundColor', draft.backgroundColor),
  backgroundAlpha: draft.backgroundAlpha ?? 1,
  ...optional('backgroundImage', draft.backgroundImage),
  ...optional('outline', draft.outline && { color: draft.outline.color ?? currentColor, width: draft.outline.width }),
  ...optional('boxShadow', draft.boxShadow),
  opacity: draft.opacity ?? DEFAULTS.css.opacity,
  rotate: draft.rotate,
  translate: draft.translate,
  ...optional('zIndex', draft.zIndex),
  overflow: draft.overflow ?? 'visible',
  ...draft.grid,
  gridColumn: draft.gridColumn ?? AUTO_PLACEMENT,
  gridRow: draft.gridRow ?? AUTO_PLACEMENT,
  textDecoration: draft.textDecoration ?? { underline: false, lineThrough: false },
  letterSpacing: draft.text.letterSpacing ?? 0,
  textTransform: draft.text.textTransform ?? 'none',
  notEmitted: draft.notEmitted,
});

/** Herança CSS: o que o nó declara vence; o resto vem do pai. */
const inheritText = (parent: InheritedText, own: InheritedText): InheritedText => ({ ...parent, ...own });

export interface Normalized {
  readonly css: CssStyle;
  /** Estilo de texto efetivo do nó (herdado + próprio). */
  readonly text: InheritedText;
  /** Props consumidas pela primitiva com os nomes da engine (src, data, fit, nowrap…). */
  readonly own: Readonly<Record<string, unknown>>;
}

export const normalizeProps = (
  kind: PrimitiveKind,
  props: Readonly<Record<string, unknown>>,
  parentText: InheritedText,
): Normalized => {
  const draft = draftOf(kind, props);
  const text = inheritText(parentText, draft.text);
  // letterSpacing e textTransform herdam (vão no css de cada nó); o resto do css não.
  const css = finalize(kind, { ...draft, text }, text.color ?? DEFAULTS.text.color);
  return { css, text, own: draft.own };
};

/**
 * `CssStyle` inicial de um Box sem props (ou com só `display`), igual ao que o resolve produz:
 * sem `display` é flex column; `'flex'` é row. Para montar nós à mão (testes, ferramentas).
 */
export const initialCss = (display?: Display): CssStyle =>
  finalize('box', display === undefined ? EMPTY_DRAFT : { ...EMPTY_DRAFT, display }, DEFAULTS.text.color);
