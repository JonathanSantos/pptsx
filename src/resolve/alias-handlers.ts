import { DEFAULTS } from '../core/defaults.ts';
import type { PrimitiveKind } from '../core/types.ts';
import { BOX_HANDLERS } from './box-handlers.ts';
import { hexListOf, hexOf, withHexFields } from './colors.ts';
import { finiteNumber, INVALID, pass, reject } from './draft.ts';
import type { Handler } from './draft.ts';
import { backgroundColor, borderRadius } from './paint-handlers.ts';
import { fontWeight, TEXT_HANDLERS, whiteSpace } from './text-handlers.ts';
import { parsePt } from './values.ts';

/**
 * Por primitiva: nomes antigos (alias até remoção futura, CONTRACTS §M11) e as props que a
 * primitiva consome com o significado da engine. Vencem o CSS homônimo (`fill` do Shape é
 * cor da forma, `border` da Table é a cor da grade).
 */

const css = (key: string): Handler => BOX_HANDLERS[key] ?? TEXT_HANDLERS[key] ?? pass(key);

const legacyStroke: Handler = (draft, value, key) => ({
  ...draft,
  outline: { color: hexOf(key, value), width: draft.outline?.width ?? DEFAULTS.strokeWidth },
});

const legacyStrokeWidth: Handler = (draft, value) => {
  const width = parsePt(value) ?? DEFAULTS.strokeWidth;
  return { ...draft, outline: { color: draft.outline?.color ?? DEFAULTS.lineStroke, width } };
};

/** `grow={n}` guarda a regra antiga do basis (0 só sem tamanho no eixo principal; ver BasisSource). */
const legacyGrow: Handler = (draft, value, key) => {
  const grow = finiteNumber(value);
  if (grow === undefined) return reject(draft, key, value, INVALID);
  return { ...draft, flexGrow: grow, basisSource: draft.basisSource === 'none' ? 'grow' : draft.basisSource };
};

const passAll = (keys: readonly string[]): Readonly<Record<string, Handler>> =>
  Object.fromEntries(keys.map((key) => [key, pass(key)]));

/** Prop de cor da primitiva: segue em `own` já como '#RRGGBB'. */
const passColor =
  (field: string, toHex: (key: string, value: unknown) => unknown = hexOf): Handler =>
  (draft, value, key) =>
    pass(field)(draft, toHex(key, value), key);

const passColors = (keys: readonly string[]): Readonly<Record<string, Handler>> =>
  Object.fromEntries(keys.map((key) => [key, passColor(key)]));

// `header={false}` não é objeto e passa intacto.
const headerColors = (key: string, value: unknown): unknown => withHexFields(key, value, ['fill', 'color']);

const CONTAINER_LEGACY: Readonly<Record<string, Handler>> = {
  direction: css('flexDirection'),
  align: css('alignItems'),
  justify: css('justifyContent'),
};

const ITEM_LEGACY: Readonly<Record<string, Handler>> = {
  grow: legacyGrow,
  shrink: css('flexShrink'),
};

const TEXT_LEGACY: Readonly<Record<string, Handler>> = {
  font: css('fontFamily'),
  size: css('fontSize'),
  weight: fontWeight,
  italic: (draft, value) => ({ ...draft, text: { ...draft.text, italic: value === true } }),
  align: css('textAlign'),
  whiteSpace,
  ...passAll(['nowrap', 'fit', 'minSize', 'maxLines']),
};

const objectFit: Handler = (draft, value, key) =>
  value === 'contain' || value === 'cover' ? pass('fit')(draft, value, key) : reject(draft, key, value, 'só contain e cover');


export const KIND_HANDLERS: Readonly<Record<PrimitiveKind, Readonly<Record<string, Handler>>>> = {
  deck: {},
  span: {},
  slide: { ...CONTAINER_LEGACY, notes: pass('notes'), fill: backgroundColor },
  box: {
    ...CONTAINER_LEGACY,
    ...ITEM_LEGACY,
    fill: backgroundColor,
    stroke: legacyStroke,
    strokeWidth: legacyStrokeWidth,
    radius: borderRadius,
    paginate: pass('paginate'),
  },
  text: { ...ITEM_LEGACY, ...TEXT_LEGACY },
  image: { ...ITEM_LEGACY, src: pass('src'), fit: pass('fit'), objectFit },
  shape: {
    ...ITEM_LEGACY,
    ...passAll(['kind', 'strokeWidth', 'radius']),
    ...passColors(['fill', 'stroke']),
    // Shape: o fundo CSS é o preenchimento da forma (a forma não tem caixa separada).
    backgroundColor: passColor('fill'),
  },
  chart: {
    ...ITEM_LEGACY,
    ...passAll(['kind', 'data', 'legend', 'showValues', 'title', 'font', 'size']),
    colors: passColor('colors', hexListOf),
  },
  table: {
    ...ITEM_LEGACY,
    ...passAll(['columns', 'rows', 'cellPadding', 'fit', 'minSize', 'font', 'size', 'lineHeight']),
    ...passColors(['stripe', 'border']),
    header: passColor('header', headerColors),
  },
};
