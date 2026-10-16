import type { PrimitiveKind } from '../core/types.ts';
import { hexListOf, hexOf, withHexFields } from './colors.ts';
import { pass, reject } from './draft.ts';
import { InvalidPropError } from './errors.ts';
import type { Handler } from './draft.ts';
import { SHAPE_CSS } from './shape-handlers.ts';
import { CONNECTOR_KEYS } from './connector-keys.ts';
import { parseHref } from './href.ts';
import { whiteSpace } from './text-handlers.ts';

/**
 * Por primitiva: as props que ela consome com o significado da engine. Vencem o CSS homônimo
 * (`fill` do Shape é a cor da forma, `border` da Table é a cor da grade). As props antigas da 0.x
 * não estão aqui: o normalize as recusa com a troca (removed-props.ts).
 */

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

/** M12: `id` de qualquer nó (alvo de Connector): string não vazia. */
const nodeId: Handler = (draft, value, key) => {
  if (typeof value !== 'string' || value.trim() === '') throw new InvalidPropError(key, value, 'use um texto não vazio, único no slide');
  return pass('id')(draft, value, key);
};

/** M13: link (URL ou slide:N), validado na forma. */
const href: Handler = (draft, value, key) => pass('href')(draft, parseHref(key, value), key);

/** M15: nome de placeholder do layout: texto não vazio (o layout confere se existe). */
const placeholder: Handler = (draft, value, key) => {
  if (typeof value !== 'string' || value.trim() === '') throw new InvalidPropError(key, value, 'use o nome de um placeholder do layout ("title", "body"…)');
  return pass('placeholder')(draft, value, key);
};

const ITEM_OWN: Readonly<Record<string, Handler>> = { id: nodeId };

const TEXT_OWN: Readonly<Record<string, Handler>> = {
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
  slide: { notes: pass('notes'), hidden: pass('hidden') },
  box: {
    ...ITEM_OWN,
    paginate: pass('paginate'),
    shape: pass('shape'),
    href,
    placeholder,
  },
  text: { ...ITEM_OWN, ...TEXT_OWN, href, paginate: pass('paginate'), placeholder },
  // M19: Container = Box sem paginate/placeholder (o conteúdo vem da função; a paginação ainda não sabe medir).
  container: { ...ITEM_OWN, shape: pass('shape'), href },
  image: { ...ITEM_OWN, src: pass('src'), objectFit, href, placeholder },
  shape: {
    ...ITEM_OWN,
    ...passAll(['kind', 'strokeWidth', 'radius', 'flipH', 'flipV', 'lineStyle', 'lineCap', 'startArrow', 'endArrow']),
    ...passColors(['fill', 'stroke']),
    ...SHAPE_CSS,
    // Shape: o fundo CSS é o preenchimento da forma (a forma não tem caixa separada).
    backgroundColor: passColor('fill'),
  },
  chart: {
    ...ITEM_OWN,
    ...passAll(['kind', 'data', 'legend', 'title', 'font', 'size', 'labels', 'xAxis', 'yAxis', 'y2Axis', 'holeSize', 'smooth', 'markers']),
    colors: passColor('colors', hexListOf),
  },
  table: {
    ...ITEM_OWN,
    ...passAll(['columns', 'rows', 'cellPadding', 'fit', 'minSize', 'lineHeight', 'headerRows', 'cell', 'paginate', 'repeatHeader', 'valign']),
    ...passColors(['stripe', 'border']),
    header: passColor('header', headerColors),
  },
  // Path: fill/stroke são a pintura do traço (como no Shape); borda/contorno CSS viram o stroke.
  path: {
    ...ITEM_OWN,
    ...passAll(['d', 'viewBox', 'strokeWidth', 'lineCap', 'lineJoin', 'lineStyle']),
    ...passColors(['fill', 'stroke']),
    ...SHAPE_CSS,
    borderRadius: (draft, value, key) => reject(draft, key, value, 'o Path não tem cantos; desenhe-os no d'),
    backgroundImage: (draft, value, key) => reject(draft, key, value, NO_BOX_REASON),
    backgroundColor: passColor('fill'),
  },
  icon: {
    ...ITEM_OWN,
    ...passAll(['src', 'size', 'recolor', 'render']),
    ...NO_BOX,
  },
  slideNumber: { ...ITEM_OWN, ...TEXT_OWN, format: pass('format') },
  connector: {
    ...passAll(CONNECTOR_KEYS),
    stroke: passColor('stroke'),
  },
};
