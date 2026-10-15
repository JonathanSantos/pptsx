import { DEFAULTS } from '../core/defaults.ts';
import type { PrimitiveKind } from '../core/types.ts';
import { hexListOf, hexOf, withHexFields } from './colors.ts';
import { finiteNumber, INVALID, pass, reject } from './draft.ts';
import { InvalidPropError } from './errors.ts';
import type { Handler } from './draft.ts';
import { backgroundColor, borderRadius } from './paint-handlers.ts';
import { SHAPE_CSS } from './shape-handlers.ts';
import { CONNECTOR_KEYS } from './connector-keys.ts';
import { fontWeight, TEXT_HANDLERS, whiteSpace } from './text-handlers.ts';
import { parsePt } from './values.ts';
import { BOX_HANDLERS } from './box-handlers.ts';

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

/** M12: `id` de qualquer nó (alvo de Connector): string não vazia. */
const nodeId: Handler = (draft, value, key) => {
  if (typeof value !== 'string' || value.trim() === '') throw new InvalidPropError(key, value, 'use um texto não vazio, único no slide');
  return pass('id')(draft, value, key);
};

const ITEM_LEGACY: Readonly<Record<string, Handler>> = {
  grow: legacyGrow,
  shrink: css('flexShrink'),
  id: nodeId,
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


const NO_BOX_REASON = 'o nó vetorial não tem caixa; envolva-o num Box para ter fundo ou borda';

/** M12: Icon não pinta caixa (fundo, borda, contorno): avisa em vez de sumir em silêncio. */
const NO_BOX: Readonly<Record<string, Handler>> = Object.fromEntries(
  [
    'background',
    'backgroundColor',
    'backgroundImage',
    'fill',
    'stroke',
    'strokeWidth',
    'border',
    'borderWidth',
    'borderColor',
    'borderStyle',
    'borderRadius',
    'borderTop',
    'borderRight',
    'borderBottom',
    'borderLeft',
    'outline',
    'outlineColor',
    'outlineWidth',
  ].map((key): [string, Handler] => [key, (draft, value) => reject(draft, key, value, NO_BOX_REASON)]),
);

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
    shape: pass('shape'),
  },
  text: { ...ITEM_LEGACY, ...TEXT_LEGACY },
  image: { ...ITEM_LEGACY, src: pass('src'), fit: pass('fit'), objectFit },
  shape: {
    ...ITEM_LEGACY,
    ...passAll(['kind', 'strokeWidth', 'radius', 'flipH', 'flipV', 'lineStyle', 'lineCap', 'startArrow', 'endArrow']),
    ...passColors(['fill', 'stroke']),
    ...SHAPE_CSS,
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
  // Path: fill/stroke são a pintura do traço (como no Shape); borda/contorno CSS viram o stroke.
  path: {
    ...ITEM_LEGACY,
    ...passAll(['d', 'viewBox', 'strokeWidth', 'lineCap', 'lineJoin', 'lineStyle']),
    ...passColors(['fill', 'stroke']),
    ...SHAPE_CSS,
    borderRadius: (draft, value, key) => reject(draft, key, value, 'o Path não tem cantos; desenhe-os no d'),
    backgroundImage: (draft, value, key) => reject(draft, key, value, NO_BOX_REASON),
    backgroundColor: passColor('fill'),
  },
  icon: {
    ...ITEM_LEGACY,
    ...passAll(['src', 'size', 'recolor', 'render']),
    ...NO_BOX,
  },
  connector: {
    ...passAll(CONNECTOR_KEYS),
    stroke: passColor('stroke'),
  },
};
