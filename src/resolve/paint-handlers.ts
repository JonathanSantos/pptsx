import { strictColorOf } from './colors.ts';
import { finiteNumber, INVALID, reject, setField } from './draft.ts';
import type { Draft, Handler } from './draft.ts';
import { SIDES } from './box-handlers.ts';
import { parseAngle, parseColor, parsePt, parseShadow, parseSides, parseTransform } from './values.ts';

/** Handlers de pintura: raio, fundo, sombra, opacidade, transformações, camadas, overflow. */

/** Cor ilegível é erro (InvalidPropError), não diagnóstico: emissor e preview divergiriam. */
export const colorHandler =
  (apply: (draft: Draft, hex: string, alpha: number) => Draft): Handler =>
  (draft, value, key) => {
    const color = strictColorOf(key, value);
    return apply(draft, color.hex, color.alpha);
  };

export const backgroundColor = colorHandler((draft, hex, alpha) => ({ ...draft, backgroundColor: hex, backgroundAlpha: alpha }));

const URL_VALUE = /^url\(\s*['"]?([^'")]+)['"]?\s*\)$/;

const backgroundImage: Handler = (draft, value, key) => {
  const match = typeof value === 'string' ? URL_VALUE.exec(value.trim()) : null;
  if (match?.[1] === undefined) return reject(draft, key, value, 'só url(...) sai no PPTX (gradiente não tem de/para)');
  return { ...draft, backgroundImage: match[1] };
};

const hasImage = (value: unknown): value is { readonly image: unknown } =>
  typeof value === 'object' && value !== null && 'image' in value;

/** `background` CSS: cor ou url(); o objeto { image } da engine também vale (Slide). */
const backgroundShorthand: Handler = (draft, value, key) => {
  if (hasImage(value)) return { ...draft, backgroundImage: String(value.image) };
  if (typeof value === 'string' && value.trim().startsWith('url(')) return backgroundImage(draft, value, key);
  // Caminho de imagem cru (API antiga do Slide: background="./bg.png").
  if (typeof value === 'string' && parseColor(value) === undefined) return { ...draft, backgroundImage: value };
  return backgroundColor(draft, value, key);
};

export const borderRadius: Handler = (draft, value, key) => {
  const sides = parseSides(value, parsePt);
  const radii = sides === undefined ? [] : SIDES.map((side) => sides[side]).filter((r): r is number => r !== undefined);
  const [first] = radii;
  if (first === undefined) return reject(draft, key, value, INVALID);
  const min = Math.min(...radii);
  const next = { ...draft, borderRadius: min };
  if (radii.every((r) => r === first)) return next;
  return reject(next, key, value, `raios por canto não existem no PPTX; sai com o menor (${min} pt)`);
};

const shadowHandler: Handler = (draft, value, key) => {
  if (value === 'none') return draft;
  const result = parseShadow(value);
  if (result === undefined) return reject(draft, key, value, INVALID);
  const { shadow, extra } = result;
  const withShadow = shadow.inset ? draft : { ...draft, boxShadow: shadow };
  const notes: readonly (readonly [boolean, string])[] = [
    [shadow.inset, 'sombra inset não existe no PPTX; não sai'],
    [extra, 'o PPTX tem uma sombra por forma; só a primeira sai'],
    [shadow.spread !== 0 && !shadow.inset, 'spread da sombra não existe no PPTX; sai sem spread'],
  ];
  return notes.reduce((acc, [hit, reason]) => (hit ? reject(acc, key, value, reason) : acc), withShadow);
};

const transformHandler: Handler = (draft, value, key) => {
  const transform = parseTransform(value);
  if (transform === undefined) return reject(draft, key, value, INVALID);
  const next = {
    ...draft,
    rotate: draft.rotate + transform.rotate,
    translate: { x: draft.translate.x + transform.translate.x, y: draft.translate.y + transform.translate.y },
  };
  return transform.unsupported.reduce(
    (acc, raw) => reject(acc, key, raw, 'só rotate e translate têm de/para (scale/skew/matrix não saem)'),
    next,
  );
};

const rotateHandler: Handler = (draft, value, key) => {
  const angle = parseAngle(value);
  return angle === undefined ? reject(draft, key, value, INVALID) : { ...draft, rotate: draft.rotate + angle };
};

const parseOpacity = (value: unknown): number | undefined => {
  const number = finiteNumber(value);
  return number === undefined ? undefined : Math.min(1, Math.max(0, number));
};

const parseZIndex = (value: unknown): number | undefined => {
  const number = finiteNumber(value);
  return number !== undefined && Number.isInteger(number) ? number : undefined;
};

const overflowHandler: Handler = (draft, value, key) => {
  if (value === 'visible' || value === 'hidden') return { ...draft, overflow: value };
  return reject(draft, key, value, INVALID);
};

export const PAINT_HANDLERS: Readonly<Record<string, Handler>> = {
  borderRadius,
  backgroundColor,
  backgroundImage,
  background: backgroundShorthand,
  boxShadow: shadowHandler,
  opacity: setField('opacity', parseOpacity),
  transform: transformHandler,
  rotate: rotateHandler,
  zIndex: setField('zIndex', parseZIndex),
  overflow: overflowHandler,
};
