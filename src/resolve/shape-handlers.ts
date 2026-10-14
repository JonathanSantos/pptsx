import { DEFAULTS } from '../core/defaults.ts';
import { SIDES } from './box-handlers.ts';
import { hexOf } from './colors.ts';
import { INVALID, pass, reject } from './draft.ts';
import type { Handler } from './draft.ts';
import { InvalidPropError } from './errors.ts';
import { parseOutline } from './outline.ts';
import { borderRadius } from './paint-handlers.ts';
import { parsePt } from './values.ts';

/**
 * Shape em CSS. A forma não tem conteúdo: borda e outline são o contorno dela (`stroke`/`strokeWidth`
 * na visão da engine) e não ocupam espaço; `borderRadius` é o `radius` do roundRect. Nada disso
 * vai para o `css` da forma, senão a decoração de caixa pintaria um segundo contorno.
 */

const withoutStroke = (own: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const { stroke: _stroke, strokeWidth: _width, ...rest } = own;
  return rest;
};

const shapeOutline: Handler = (draft, value, key) => {
  const result = parseOutline(value);
  if (result === undefined) return reject(draft, key, value, INVALID);
  if (result.part === 'none') return { ...draft, own: withoutStroke(draft.own) };
  const { color, width } = result.part;
  const stroke = color ?? draft.own.stroke ?? DEFAULTS.lineStroke;
  const next = { ...draft, own: { ...draft.own, stroke, strokeWidth: width } };
  return result.reason === undefined ? next : reject(next, key, value, result.reason);
};

const shapeStrokeStyle: Handler = (draft, value, key) => {
  if (value === 'none') return { ...draft, own: withoutStroke(draft.own) };
  if (value === 'solid') return draft;
  return reject(draft, key, value, 'o PPTX só tem contorno sólido; sai sólido');
};

const shapeRadius: Handler = (draft, value, key) => {
  const next = borderRadius(draft, value, key);
  return next.borderRadius === undefined ? next : { ...next, borderRadius: undefined, own: { ...next.own, radius: next.borderRadius } };
};

const SIDE_BORDER = 'a forma não tem borda por lado; use border ou outline (contorno inteiro)';

const shapeSideBorders: Readonly<Record<string, Handler>> = Object.fromEntries(
  SIDES.flatMap((side) => {
    const name = `border${side.charAt(0).toUpperCase()}${side.slice(1)}`;
    return [name, `${name}Width`, `${name}Style`, `${name}Color`].map((key): [string, Handler] => [
      key,
      (draft, value) => reject(draft, key, value, SIDE_BORDER),
    ]);
  }),
);

/** borderWidth/borderColor com 1 a 4 valores: na forma só vale um para o contorno inteiro. */
const uniformOnly =
  (field: 'stroke' | 'strokeWidth', parse: (key: string, value: unknown) => unknown): Handler =>
  (draft, value, key) => {
    const perSide = typeof value === 'string' && /\s/.test(value.trim()) && !value.includes('(');
    if (perSide) return reject(draft, key, value, SIDE_BORDER);
    return pass(field)(draft, parse(key, value), key);
  };

const strokeWidthOf = (key: string, value: unknown): unknown => {
  const width = parsePt(value);
  if (width === undefined) throw new InvalidPropError(key, value, 'use uma largura em pt (número ou "2px")');
  return width;
};

export const SHAPE_CSS: Readonly<Record<string, Handler>> = {
  ...shapeSideBorders,
  border: shapeOutline,
  outline: shapeOutline,
  borderColor: uniformOnly('stroke', hexOf),
  outlineColor: uniformOnly('stroke', hexOf),
  borderWidth: uniformOnly('strokeWidth', strokeWidthOf),
  outlineWidth: uniformOnly('strokeWidth', strokeWidthOf),
  borderStyle: shapeStrokeStyle,
  borderRadius: shapeRadius,
};
