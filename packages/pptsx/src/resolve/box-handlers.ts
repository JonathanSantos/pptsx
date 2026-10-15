import { DEFAULTS } from '../core/defaults.ts';
import type { Len, MarginLen, Side, Sides } from '../core/types.ts';
import { parseTrackList } from '../layout/index.ts';
import { strictColorOf } from './colors.ts';
import { finiteNumber, INVALID, parsed, reject, setField } from './draft.ts';
import type { BorderDraft, GridTrackKey, Handler, SizeKey } from './draft.ts';
import {
  parseAlign,
  parseAlignContent,
  parseDirection,
  parseDisplay,
  parseJustify,
  parsePlace,
  parsePosition,
  parseWrap,
} from './keywords.ts';
import {
  parseBorder,
  parseBorderStyle,
  parseColor,
  parseFlex,
  parseGridLine,
  parseGridPlacement,
  parseLength,
  parseMargin,
  parsePt,
  parseSides,
} from './values.ts';
import type { ParsedBorder } from './values.ts';

/** Handlers do box model: posição, tamanhos, flex, espaçamentos, bordas e grid. */

export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

type SidesField = 'margin' | 'padding' | 'inset';
type SideParser = (value: unknown) => Len | MarginLen | undefined;

const boxSides =
  (field: SidesField, parse: SideParser): Handler =>
  (draft, value, key) => {
    const sides = parseSides(value, parse);
    if (sides === undefined) return reject(draft, key, value, INVALID);
    return { ...draft, [field]: { ...(draft[field] as Partial<Sides<unknown>>), ...sides } };
  };

const oneSide =
  (field: SidesField, side: Side, parse: SideParser): Handler =>
  (draft, value, key) => {
    const item = parse(value);
    if (item === undefined) return reject(draft, key, value, INVALID);
    return { ...draft, [field]: { ...(draft[field] as object), [side]: item } };
  };

const borderDraftOf = (parsedBorder: ParsedBorder): BorderDraft => ({
  ...(parsedBorder.width === undefined ? {} : { width: parsedBorder.width }),
  ...(parsedBorder.style === undefined ? {} : { style: parsedBorder.style }),
  ...(parsedBorder.color === undefined ? {} : { color: parsedBorder.color.hex, alpha: parsedBorder.color.alpha }),
});

/** `border`/`borderTop`: o shorthand redefine o lado inteiro (o que falta volta ao inicial). */
const borderShorthand =
  (sides: readonly Side[]): Handler =>
  (draft, value, key) => {
    const parsedBorder = parseBorder(value);
    if (parsedBorder === undefined) return reject(draft, key, value, INVALID);
    const side: BorderDraft = { width: DEFAULTS.css.borderMediumWidth, style: 'none', ...borderDraftOf(parsedBorder) };
    return { ...draft, border: { ...draft.border, ...Object.fromEntries(sides.map((s) => [s, side])) } };
  };

type BorderPart = 'width' | 'style' | 'color';

const borderPartOf = (part: BorderPart, value: unknown, key: string): BorderDraft | undefined => {
  if (part === 'width') {
    const width = parsePt(value);
    return width === undefined ? undefined : { width };
  }
  if (part === 'style') {
    const style = parseBorderStyle(value);
    return style === undefined ? undefined : { style };
  }
  const color = strictColorOf(key, value);
  return { color: color.hex, alpha: color.alpha };
};

const borderPart =
  (sides: readonly Side[], part: BorderPart): Handler =>
  (draft, value, key) => {
    const update = borderPartOf(part, value, key);
    if (update === undefined) return reject(draft, key, value, INVALID);
    const border = Object.fromEntries(sides.map((s) => [s, { ...draft.border[s], ...update }]));
    return { ...draft, border: { ...draft.border, ...border } };
  };

// rgba(…) tem espaços: uma cor só vale para os quatro lados antes de quebrar em tokens.
const sidesOfPart = (part: BorderPart, value: unknown, key: string): Partial<Sides<BorderDraft>> | undefined => {
  const single = part === 'color' ? parseColor(value) : undefined;
  if (single !== undefined) {
    const side: BorderDraft = { color: single.hex, alpha: single.alpha };
    return { top: side, right: side, bottom: side, left: side };
  }
  return parseSides(value, (item) => borderPartOf(part, item, key));
};

/** borderWidth/borderColor/borderStyle com 1 a 4 valores, como no CSS. */
const borderPartSides =
  (part: BorderPart): Handler =>
  (draft, value, key) => {
    const sides = sidesOfPart(part, value, key);
    if (sides === undefined) return reject(draft, key, value, INVALID);
    const border = Object.fromEntries(
      SIDES.flatMap((s) => (sides[s] === undefined ? [] : [[s, { ...draft.border[s], ...sides[s] }]])),
    );
    return { ...draft, border: { ...draft.border, ...border } };
  };

const size =
  (key: SizeKey): Handler =>
  (draft, value, name) => {
    const length = parseLength(value);
    if (length === undefined) return reject(draft, name, value, INVALID);
    return { ...draft, sizes: { ...draft.sizes, [key]: length } };
  };

const parseAspectRatio = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value > 0 ? value : undefined;
  const [w, h] = typeof value === 'string' ? value.split('/').map(Number) : [];
  return w !== undefined && h !== undefined && w > 0 && h > 0 ? w / h : undefined;
};

const gapHandler: Handler = (draft, value, key) => {
  const sides = typeof value === 'string' ? value.trim().split(/\s+/).map(parsePt) : [parsePt(value)];
  const [row, column = row] = sides;
  if (row === undefined || column === undefined || sides.length > 2) return reject(draft, key, value, INVALID);
  return { ...draft, rowGap: row, columnGap: column };
};

const flexHandler: Handler = parsed(parseFlex, (draft, flex) => ({
  ...draft,
  flexGrow: flex.grow,
  flexShrink: flex.shrink,
  flexBasis: flex.basis,
  basisSource: flex.implicitZero ? 'flex' : 'author',
}));

const flexBasisHandler: Handler = (draft, value, key) => {
  const basis = value === 'auto' ? 'auto' : parseLength(value);
  if (basis === undefined) return reject(draft, key, value, INVALID);
  return { ...draft, flexBasis: basis, basisSource: 'author' };
};

/** `auto` é o inicial: não declara nada. */
const autoOr =
  (handler: Handler): Handler =>
  (draft, value, key) =>
    value === 'auto' ? draft : handler(draft, value, key);

const placeShorthand =
  (align: 'alignItems' | 'alignSelf', justify: 'justifyItems' | 'justifySelf'): Handler =>
  (draft, value, key) => {
    const [a, j = a] = typeof value === 'string' ? value.trim().split(/\s+/) : [];
    const alignValue = parseAlign(a);
    const justifyValue = parsePlace(j);
    if (alignValue === undefined || justifyValue === undefined) return reject(draft, key, value, INVALID);
    return { ...draft, [align]: alignValue, [justify]: justifyValue };
  };

const gridLineHandler =
  (field: 'gridColumn' | 'gridRow', part: 'start' | 'end'): Handler =>
  (draft, value, key) => {
    const line = parseGridLine(value);
    if (line === undefined) return reject(draft, key, value, INVALID);
    const current = draft[field] ?? { start: { kind: 'auto' }, end: { kind: 'auto' } };
    return { ...draft, [field]: { ...current, [part]: line } };
  };

const TRACK_SUBSET =
  'sintaxe de track fora do subconjunto suportado (px, %, fr, auto, min/max-content, minmax, repeat(n, …)); a grade ignora este valor';

/** Tracks fora do subconjunto (áreas nomeadas, auto-fill…) viram diagnóstico em vez de sumir. */
const trackList =
  (field: GridTrackKey): Handler =>
  (draft, value, key) => {
    const text = typeof value === 'number' ? `${value}px` : String(value);
    if (parseTrackList(text) === undefined) return reject(draft, key, value, TRACK_SUBSET);
    return { ...draft, grid: { ...draft.grid, [field]: text } };
  };

const SIZE_KEYS: readonly SizeKey[] = ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'];

const perSide = (side: Side): readonly (readonly [string, Handler])[] => [
  [`margin${capitalize(side)}`, oneSide('margin', side, parseMargin)],
  [`padding${capitalize(side)}`, oneSide('padding', side, parseLength)],
  [`border${capitalize(side)}`, borderShorthand([side])],
  [`border${capitalize(side)}Width`, borderPart([side], 'width')],
  [`border${capitalize(side)}Style`, borderPart([side], 'style')],
  [`border${capitalize(side)}Color`, borderPart([side], 'color')],
];

export const BOX_HANDLERS: Readonly<Record<string, Handler>> = {
  display: setField('display', parseDisplay),
  position: setField('position', parsePosition),
  inset: boxSides('inset', parseLength),
  ...Object.fromEntries(SIDES.map((side) => [side, oneSide('inset', side, parseLength)])),
  ...Object.fromEntries(SIZE_KEYS.map((key) => [key, size(key)])),
  aspectRatio: setField('aspectRatio', parseAspectRatio),
  boxSizing: (draft, value, key) => (value === 'border-box' ? draft : reject(draft, key, value, 'a engine é sempre border-box')),
  flexDirection: setField('flexDirection', parseDirection),
  flexWrap: setField('flexWrap', parseWrap),
  justifyContent: setField('justifyContent', parseJustify),
  alignItems: setField('alignItems', parseAlign),
  alignContent: setField('alignContent', parseAlignContent),
  alignSelf: autoOr(setField('alignSelf', parseAlign)),
  justifySelf: autoOr(setField('justifySelf', parsePlace)),
  justifyItems: setField('justifyItems', parsePlace),
  placeItems: placeShorthand('alignItems', 'justifyItems'),
  placeSelf: placeShorthand('alignSelf', 'justifySelf'),
  flex: flexHandler,
  flexGrow: setField('flexGrow', finiteNumber),
  flexShrink: setField('flexShrink', finiteNumber),
  flexBasis: flexBasisHandler,
  order: setField('order', finiteNumber),
  gap: gapHandler,
  rowGap: setField('rowGap', parsePt),
  columnGap: setField('columnGap', parsePt),
  margin: boxSides('margin', parseMargin),
  padding: boxSides('padding', parseLength),
  ...Object.fromEntries(SIDES.flatMap(perSide)),
  border: borderShorthand(SIDES),
  borderWidth: borderPartSides('width'),
  borderStyle: borderPartSides('style'),
  borderColor: borderPartSides('color'),
  gridTemplateColumns: trackList('gridTemplateColumns'),
  gridTemplateRows: trackList('gridTemplateRows'),
  gridAutoRows: trackList('gridAutoRows'),
  gridAutoColumns: trackList('gridAutoColumns'),
  gridAutoFlow: (draft, value, key) => (value === 'row' ? draft : reject(draft, key, value, 'só auto-placement em linhas (row)')),
  gridColumn: setField('gridColumn', parseGridPlacement),
  gridRow: setField('gridRow', parseGridPlacement),
  gridColumnStart: gridLineHandler('gridColumn', 'start'),
  gridColumnEnd: gridLineHandler('gridColumn', 'end'),
  gridRowStart: gridLineHandler('gridRow', 'start'),
  gridRowEnd: gridLineHandler('gridRow', 'end'),
};
