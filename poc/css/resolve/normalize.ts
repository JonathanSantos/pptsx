import { DEFAULTS } from '../../../src/core/defaults.ts';
import type { PrimitiveKind, TextAlign } from '../../../src/core/types.ts';
import { POC_DEFAULTS } from '../defaults.ts';
import type {
  BasisSource,
  BorderSide,
  BorderStyle,
  CssAlign,
  CssAlignContent,
  CssFlexDirection,
  CssFlexWrap,
  CssJustify,
  CssPlace,
  CssPosition,
  CssStyle,
  Display,
  GridPlacement,
  Len,
  MarginLen,
  NotEmitted,
  Shadow,
  Side,
  Sides,
  TextDecoration,
  TextTransform,
} from '../types.ts';
import {
  parseAngle,
  parseBorder,
  parseBorderStyle,
  parseColor,
  parseFlex,
  parseFontWeight,
  parseGridLine,
  parseGridPlacement,
  parseLength,
  parseMargin,
  parsePt,
  parseShadow,
  parseSides,
  parseTransform,
  type ParsedBorder,
} from './values.ts';
import { parseTrackList } from '../layout/grid.ts';

/**
 * Normalização de um nó: props do autor (já sem responsivo) → `CssStyle` (sem shorthands,
 * nomes antigos convertidos) + o estilo de texto que desce para os filhos (herança).
 * Puro: nada aqui lê arquivo ou depende de ordem global.
 */

// ───────────────────────── herança ─────────────────────────

/** Propriedades de texto que descem do Slide/Box para os Text (CSS: inherited). */
export interface InheritedText {
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly weight?: 'regular' | 'bold';
  readonly italic?: boolean;
  readonly color?: string;
  readonly lineHeight?: number;
  readonly textAlign?: TextAlign;
  readonly letterSpacing?: number;
  readonly textTransform?: TextTransform;
}

export const ROOT_TEXT: InheritedText = {};

// ───────────────────────── rascunho ─────────────────────────

interface BorderDraft {
  readonly width?: number;
  readonly style?: BorderStyle;
  readonly color?: string;
  readonly alpha?: number;
}

/** Tudo opcional: o que o autor declarou; `finalize` aplica os padrões por kind. */
interface Draft {
  readonly display?: Display;
  readonly position?: CssPosition;
  readonly inset: Partial<Sides<Len>>;
  readonly sizes: Partial<Record<SizeKey, Len>>;
  readonly aspectRatio?: number;
  readonly flexDirection?: CssFlexDirection;
  readonly flexWrap?: CssFlexWrap;
  readonly justifyContent?: CssJustify;
  readonly alignItems?: CssAlign;
  readonly alignContent?: CssAlignContent;
  readonly alignSelf?: CssAlign;
  readonly justifySelf?: CssPlace;
  readonly justifyItems?: CssPlace;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly flexBasis?: Len | 'auto';
  readonly basisSource: BasisSource;
  readonly order?: number;
  readonly rowGap?: number;
  readonly columnGap?: number;
  readonly margin: Partial<Sides<MarginLen>>;
  readonly padding: Partial<Sides<Len>>;
  readonly border: Partial<Sides<BorderDraft>>;
  readonly borderRadius?: number;
  readonly backgroundColor?: string;
  readonly backgroundAlpha?: number;
  readonly backgroundImage?: string;
  readonly outline?: { readonly color: string; readonly width: number };
  readonly boxShadow?: Shadow;
  readonly opacity?: number;
  readonly rotate: number;
  readonly translate: { readonly x: number; readonly y: number };
  readonly zIndex?: number;
  readonly overflow?: 'visible' | 'hidden';
  readonly grid: Partial<Record<GridTrackKey, string>>;
  readonly gridColumn?: GridPlacement;
  readonly gridRow?: GridPlacement;
  readonly text: InheritedText;
  readonly textDecoration?: TextDecoration;
  /** Props que a primitiva consome direto (src, data, fit, nowrap, kind…), já com os nomes da engine. */
  readonly own: Readonly<Record<string, unknown>>;
  readonly notEmitted: readonly NotEmitted[];
}

type SizeKey = 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight';
type GridTrackKey = 'gridTemplateColumns' | 'gridTemplateRows' | 'gridAutoRows' | 'gridAutoColumns';

const EMPTY_DRAFT: Draft = {
  inset: {},
  sizes: {},
  basisSource: 'none',
  margin: {},
  padding: {},
  border: {},
  rotate: 0,
  translate: { x: 0, y: 0 },
  grid: {},
  text: {},
  own: {},
  notEmitted: [],
};

type Handler = (draft: Draft, value: unknown, key: string) => Draft;

const describe = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

const reject = (draft: Draft, key: string, value: unknown, reason: string): Draft => ({
  ...draft,
  notEmitted: [...draft.notEmitted, { property: key, value: describe(value), reason }],
});

const INVALID = 'valor não reconhecido; ignorado';

/** Handler que só aceita o valor quando o parser entende; senão vira css-not-emitted. */
const parsed =
  <T>(parse: (value: unknown) => T | undefined, apply: (draft: Draft, value: T) => Draft): Handler =>
  (draft, value, key) => {
    const result = parse(value);
    return result === undefined ? reject(draft, key, value, INVALID) : apply(draft, result);
  };

const oneOf =
  <T extends string>(options: readonly T[], aliases: Readonly<Record<string, T>> = {}) =>
  (value: unknown): T | undefined => {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return aliases[text] ?? ((options as readonly string[]).includes(text) ? (text as T) : undefined);
  };

const finiteNumber = (value: unknown): number | undefined => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
};

// ───────────────────────── vocabulário ─────────────────────────

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Alinhamentos antigos ('start', 'between') e os do CSS ('flex-start', 'space-between'). */
const ALIGN_ALIASES: Readonly<Record<string, CssAlign>> = { start: 'flex-start', end: 'flex-end' };
const JUSTIFY_ALIASES: Readonly<Record<string, CssJustify>> = {
  start: 'flex-start',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const parseAlign = oneOf<CssAlign>(['flex-start', 'center', 'flex-end', 'stretch', 'baseline'], ALIGN_ALIASES);
const parseJustify = oneOf<CssJustify>(['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'], JUSTIFY_ALIASES);
const parseAlignContent = oneOf<CssAlignContent>(
  ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'stretch'],
  JUSTIFY_ALIASES,
);
const parsePlace = oneOf<CssPlace>(['start', 'center', 'end', 'stretch'], { 'flex-start': 'start', 'flex-end': 'end' });
const parseDirection = oneOf<CssFlexDirection>(['row', 'column', 'row-reverse', 'column-reverse']);
const parseWrap = oneOf<CssFlexWrap>(['nowrap', 'wrap', 'wrap-reverse']);
const parseDisplay = oneOf<Display>(['flex', 'block', 'grid', 'none']);
const parsePosition = oneOf<CssPosition>(['static', 'relative', 'absolute']);
const parseTextAlign = oneOf<TextAlign>(['left', 'center', 'right'], { start: 'left', end: 'right' });
const parseTextTransform = oneOf<TextTransform>(['none', 'uppercase', 'lowercase', 'capitalize']);

const parseDecoration = (value: unknown): TextDecoration | undefined => {
  if (typeof value !== 'string') return undefined;
  const tokens = value.trim().split(/\s+/);
  if (tokens.some((token) => !['none', 'underline', 'line-through'].includes(token))) return undefined;
  return { underline: tokens.includes('underline'), lineThrough: tokens.includes('line-through') };
};

// ───────────────────────── handlers por propriedade ─────────────────────────

const withSides = <T>(current: Partial<Sides<T>>, update: Partial<Sides<T>>): Partial<Sides<T>> => ({ ...current, ...update });

const boxSides =
  (field: 'margin' | 'padding' | 'inset', parse: (value: unknown) => Len | MarginLen | undefined): Handler =>
  (draft, value, key) => {
    const sides = parseSides(value, parse);
    if (sides === undefined) return reject(draft, key, value, INVALID);
    return { ...draft, [field]: withSides(draft[field] as Partial<Sides<unknown>>, sides) };
  };

const oneSide =
  (field: 'margin' | 'padding' | 'inset', side: Side, parse: (value: unknown) => Len | MarginLen | undefined): Handler =>
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
    const side: BorderDraft = { width: POC_DEFAULTS.borderMediumWidth, style: 'none', ...borderDraftOf(parsedBorder) };
    return { ...draft, border: { ...draft.border, ...Object.fromEntries(sides.map((s) => [s, side])) } };
  };

const borderPart =
  (sides: readonly Side[], part: 'width' | 'style' | 'color'): Handler =>
  (draft, value, key) => {
    const update = borderPartOf(part, value);
    if (update === undefined) return reject(draft, key, value, INVALID);
    const border = Object.fromEntries(sides.map((s) => [s, { ...draft.border[s], ...update }]));
    return { ...draft, border: { ...draft.border, ...border } };
  };

const borderPartOf = (part: 'width' | 'style' | 'color', value: unknown): BorderDraft | undefined => {
  if (part === 'width') {
    const width = parsePt(value);
    return width === undefined ? undefined : { width };
  }
  if (part === 'style') {
    const style = parseBorderStyle(value);
    return style === undefined ? undefined : { style };
  }
  const color = parseColor(value);
  return color === undefined ? undefined : { color: color.hex, alpha: color.alpha };
};

/** borderWidth/borderColor/borderStyle com 1 a 4 valores, como no CSS. */
const borderPartSides =
  (part: 'width' | 'style' | 'color'): Handler =>
  (draft, value, key) => {
    const sides = parseSides(typeof value === 'string' && part === 'color' ? value : value, (item) => borderPartOf(part, item));
    if (sides === undefined) return reject(draft, key, value, INVALID);
    const border = Object.fromEntries(SIDES.flatMap((s) => (sides[s] === undefined ? [] : [[s, { ...draft.border[s], ...sides[s] }]])));
    return { ...draft, border: { ...draft.border, ...border } };
  };

const size =
  (key: SizeKey): Handler =>
  (draft, value, name) => {
    const length = parseLength(value);
    if (length === undefined) return reject(draft, name, value, INVALID);
    return { ...draft, sizes: { ...draft.sizes, [key]: length } };
  };

const setField =
  <K extends keyof Draft>(field: K, parse: (value: unknown) => Draft[K] | undefined): Handler =>
  (draft, value, key) => {
    const result = parse(value);
    return result === undefined ? reject(draft, key, value, INVALID) : { ...draft, [field]: result };
  };

const setText =
  <K extends keyof InheritedText>(field: K, parse: (value: unknown) => InheritedText[K] | undefined): Handler =>
  (draft, value, key) => {
    const result = parse(value);
    return result === undefined ? reject(draft, key, value, INVALID) : { ...draft, text: { ...draft.text, [field]: result } };
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

const colorHandler =
  (apply: (draft: Draft, hex: string, alpha: number) => Draft): Handler =>
  (draft, value, key) => {
    const color = parseColor(value);
    return color === undefined ? reject(draft, key, value, INVALID) : apply(draft, color.hex, color.alpha);
  };

const backgroundColor = colorHandler((draft, hex, alpha) => ({ ...draft, backgroundColor: hex, backgroundAlpha: alpha }));

const URL_VALUE = /^url\(\s*['"]?([^'")]+)['"]?\s*\)$/;

const backgroundImage: Handler = (draft, value, key) => {
  const match = typeof value === 'string' ? URL_VALUE.exec(value.trim()) : null;
  if (match?.[1] === undefined) return reject(draft, key, value, 'só url(...) sai no PPTX (gradiente não tem de/para nesta PoC)');
  return { ...draft, backgroundImage: match[1] };
};

/** `background` CSS: cor ou url(); o objeto { image } da engine também vale (Slide). */
const backgroundShorthand: Handler = (draft, value, key) => {
  if (typeof value === 'object' && value !== null && 'image' in value) {
    return { ...draft, backgroundImage: String((value as { image: unknown }).image) };
  }
  if (typeof value === 'string' && value.trim().startsWith('url(')) return backgroundImage(draft, value, key);
  if (typeof value === 'string' && parseColor(value) === undefined) {
    // Caminho de imagem cru (API antiga do Slide: background="./bg.png").
    return { ...draft, backgroundImage: value };
  }
  return backgroundColor(draft, value, key);
};

const shadowHandler: Handler = (draft, value, key) => {
  if (value === 'none') return draft;
  const result = parseShadow(value);
  if (result === undefined) return reject(draft, key, value, INVALID);
  const { shadow, extra } = result;
  const withShadow = shadow.inset ? draft : { ...draft, boxShadow: shadow };
  const notes: readonly [boolean, string][] = [
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

const fontWeight: Handler = (draft, value, key) => {
  const weight = parseFontWeight(value);
  if (weight === undefined) return reject(draft, key, value, INVALID);
  const next = { ...draft, text: { ...draft.text, weight: weight.weight } };
  return weight.exact ? next : reject(next, key, value, `a engine só tem regular e bold; sai como ${weight.weight}`);
};

const fontStyle: Handler = (draft, value, key) => {
  if (value === 'italic' || value === 'normal') return { ...draft, text: { ...draft.text, italic: value === 'italic' } };
  return reject(draft, key, value, INVALID);
};

const lineHeight: Handler = (draft, value, key) => {
  if (value === 'normal') return { ...draft, text: { ...draft.text, lineHeight: DEFAULTS.text.lineHeight } };
  const number = finiteNumber(value);
  if (typeof value === 'number' && number !== undefined && number > 0) return { ...draft, text: { ...draft.text, lineHeight: number } };
  return reject(draft, key, value, 'só número (múltiplo da altura natural da fonte) ou "normal"');
};

const whiteSpace: Handler = (draft, value, key) => {
  if (value === 'nowrap' || value === 'normal') return { ...draft, own: { ...draft.own, nowrap: value === 'nowrap' } };
  return reject(draft, key, value, 'só normal e nowrap');
};

const overflowHandler: Handler = (draft, value, key) => {
  if (value === 'visible' || value === 'hidden') return { ...draft, overflow: value };
  return reject(draft, key, value, INVALID);
};

const placeShorthand =
  (align: 'alignItems' | 'alignSelf', justify: 'justifyItems' | 'justifySelf'): Handler =>
  (draft, value, key) => {
    const [a, j = a] = typeof value === 'string' ? value.trim().split(/\s+/) : [];
    const alignValue = parseAlign(a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : a);
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

const keepOwn =
  (name: string = ''): Handler =>
  (draft, value, key) => ({ ...draft, own: { ...draft.own, [name || key]: value } });

const pass =
  (field: string): Handler =>
  (draft, value) => ({ ...draft, own: { ...draft.own, [field]: value } });

/** Tracks fora do subconjunto (áreas nomeadas, auto-fill…) viram diagnóstico em vez de sumir. */
const trackList =
  (field: GridTrackKey): Handler =>
  (draft, value, key) => {
    const text = typeof value === 'number' ? `${value}px` : String(value);
    if (parseTrackList(text) === undefined) {
      return reject(draft, key, value, 'sintaxe de track fora do subconjunto da PoC (px, %, fr, auto, min/max-content, minmax, repeat(n, …)); a grade ignora este valor');
    }
    return { ...draft, grid: { ...draft.grid, [field]: text } };
  };

const CSS_HANDLERS: Readonly<Record<string, Handler>> = {
  display: setField('display', parseDisplay),
  position: setField('position', parsePosition),
  inset: boxSides('inset', parseLength),
  ...Object.fromEntries(SIDES.map((side) => [side, oneSide('inset', side, parseLength)])),
  ...Object.fromEntries((['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const).map((key) => [key, size(key)])),
  aspectRatio: setField('aspectRatio', (value) => {
    if (typeof value === 'number') return value > 0 ? value : undefined;
    const [w, h] = typeof value === 'string' ? value.split('/').map(Number) : [];
    return w !== undefined && h !== undefined && w > 0 && h > 0 ? w / h : undefined;
  }),
  boxSizing: (draft, value, key) => (value === 'border-box' ? draft : reject(draft, key, value, 'a PoC é sempre border-box')),
  flexDirection: setField('flexDirection', parseDirection),
  flexWrap: setField('flexWrap', parseWrap),
  justifyContent: setField('justifyContent', parseJustify),
  alignItems: setField('alignItems', parseAlign),
  alignContent: setField('alignContent', parseAlignContent),
  alignSelf: (draft, value, key) => (value === 'auto' ? draft : setField('alignSelf', parseAlign)(draft, value, key)),
  justifySelf: (draft, value, key) => (value === 'auto' ? draft : setField('justifySelf', parsePlace)(draft, value, key)),
  justifyItems: setField('justifyItems', parsePlace),
  placeItems: placeShorthand('alignItems', 'justifyItems'),
  placeSelf: placeShorthand('alignSelf', 'justifySelf'),
  flex: flexHandler,
  flexGrow: setField('flexGrow', finiteNumber),
  flexShrink: setField('flexShrink', finiteNumber),
  flexBasis: (draft, value, key) => {
    const basis = value === 'auto' ? 'auto' : parseLength(value);
    if (basis === undefined) return reject(draft, key, value, INVALID);
    return { ...draft, flexBasis: basis, basisSource: 'author' };
  },
  order: setField('order', finiteNumber),
  gap: gapHandler,
  rowGap: setField('rowGap', parsePt),
  columnGap: setField('columnGap', parsePt),
  margin: boxSides('margin', parseMargin),
  padding: boxSides('padding', parseLength),
  ...Object.fromEntries(SIDES.flatMap((side) => [
    [`margin${capitalize(side)}`, oneSide('margin', side, parseMargin)],
    [`padding${capitalize(side)}`, oneSide('padding', side, parseLength)],
    [`border${capitalize(side)}`, borderShorthand([side])],
    [`border${capitalize(side)}Width`, borderPart([side], 'width')],
    [`border${capitalize(side)}Style`, borderPart([side], 'style')],
    [`border${capitalize(side)}Color`, borderPart([side], 'color')],
  ])),
  border: borderShorthand(SIDES),
  borderWidth: borderPartSides('width'),
  borderStyle: borderPartSides('style'),
  borderColor: borderPartSides('color'),
  borderRadius: (draft, value, key) => {
    const sides = parseSides(value, parsePt);
    const radii = sides === undefined ? [] : SIDES.map((side) => sides[side]).filter((r): r is number => r !== undefined);
    const [first] = radii;
    if (first === undefined) return reject(draft, key, value, INVALID);
    const min = Math.min(...radii);
    const next = { ...draft, borderRadius: min };
    return radii.every((r) => r === first) ? next : reject(next, key, value, `raios por canto não existem no PPTX; sai com o menor (${min} pt)`);
  },
  backgroundColor,
  backgroundImage,
  background: backgroundShorthand,
  boxShadow: shadowHandler,
  opacity: setField('opacity', (value) => {
    const number = finiteNumber(value);
    return number === undefined ? undefined : Math.min(1, Math.max(0, number));
  }),
  transform: transformHandler,
  rotate: (draft, value, key) => {
    const angle = parseAngle(value);
    return angle === undefined ? reject(draft, key, value, INVALID) : { ...draft, rotate: draft.rotate + angle };
  },
  zIndex: setField('zIndex', (value) => {
    const number = finiteNumber(value);
    return number !== undefined && Number.isInteger(number) ? number : undefined;
  }),
  overflow: overflowHandler,
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
  fontFamily: setText('fontFamily', (value) => (typeof value === 'string' && value.trim() !== '' ? value.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '') : undefined)),
  fontSize: setText('fontSize', parsePt),
  fontWeight,
  fontStyle,
  color: colorHandler((draft, hex) => ({ ...draft, text: { ...draft.text, color: hex } })),
  lineHeight,
  textAlign: setText('textAlign', parseTextAlign),
  letterSpacing: setText('letterSpacing', (value) => (value === 'normal' ? 0 : parsePt(value))),
  textTransform: setText('textTransform', parseTextTransform),
  textDecoration: setField('textDecoration', parseDecoration),
};

// ───────────────────────── nomes antigos (açúcar) por primitiva ─────────────────────────

const legacyStroke: Handler = (draft, value, key) => {
  const color = parseColor(value);
  if (color === undefined) return reject(draft, key, value, INVALID);
  return { ...draft, outline: { color: color.hex, width: draft.outline?.width ?? DEFAULTS.strokeWidth } };
};

const legacyStrokeWidth: Handler = (draft, value) => {
  const width = parsePt(value) ?? DEFAULTS.strokeWidth;
  return { ...draft, outline: { color: draft.outline?.color ?? DEFAULTS.lineStroke, width } };
};

const legacyGrow: Handler = (draft, value, key) => {
  const grow = finiteNumber(value);
  if (grow === undefined) return reject(draft, key, value, INVALID);
  return { ...draft, flexGrow: grow, basisSource: draft.basisSource === 'none' ? 'grow' : draft.basisSource };
};

const CONTAINER_LEGACY: Readonly<Record<string, Handler>> = {
  direction: CSS_HANDLERS.flexDirection!,
  align: CSS_HANDLERS.alignItems!,
  justify: CSS_HANDLERS.justifyContent!,
};

const ITEM_LEGACY: Readonly<Record<string, Handler>> = {
  grow: legacyGrow,
  shrink: CSS_HANDLERS.flexShrink!,
};

const TEXT_LEGACY: Readonly<Record<string, Handler>> = {
  font: CSS_HANDLERS.fontFamily!,
  size: CSS_HANDLERS.fontSize!,
  weight: fontWeight,
  italic: (draft, value) => ({ ...draft, text: { ...draft.text, italic: value === true } }),
  align: CSS_HANDLERS.textAlign!,
  whiteSpace,
  nowrap: pass('nowrap'),
  fit: pass('fit'),
  minSize: pass('minSize'),
  maxLines: pass('maxLines'),
};

/** Por kind: chaves que a primitiva consome com o significado da engine (vencem o CSS homônimo). */
const KIND_HANDLERS: Readonly<Record<PrimitiveKind, Readonly<Record<string, Handler>>>> = {
  deck: {},
  span: {},
  slide: { ...CONTAINER_LEGACY, notes: pass('notes'), fill: backgroundColor },
  box: { ...CONTAINER_LEGACY, ...ITEM_LEGACY, fill: backgroundColor, stroke: legacyStroke, strokeWidth: legacyStrokeWidth, radius: CSS_HANDLERS.borderRadius!, paginate: pass('paginate') },
  text: { ...ITEM_LEGACY, ...TEXT_LEGACY },
  image: { ...ITEM_LEGACY, src: pass('src'), fit: pass('fit'), objectFit: (draft, value, key) => (value === 'contain' || value === 'cover' ? pass('fit')(draft, value, key) : reject(draft, key, value, 'só contain e cover')) },
  shape: { ...ITEM_LEGACY, kind: pass('kind'), fill: pass('fill'), stroke: pass('stroke'), strokeWidth: pass('strokeWidth'), radius: pass('radius'), backgroundColor: (draft, value) => pass('fill')(draft, parseColor(value)?.hex ?? value, 'fill') },
  chart: { ...ITEM_LEGACY, ...Object.fromEntries(['kind', 'data', 'colors', 'legend', 'showValues', 'title', 'font', 'size'].map((key) => [key, pass(key)])) },
  table: { ...ITEM_LEGACY, ...Object.fromEntries(['columns', 'rows', 'header', 'stripe', 'border', 'cellPadding', 'fit', 'minSize', 'font', 'size', 'lineHeight'].map((key) => [key, pass(key)])) },
};

// Escape: chaves que não são CSS nem da primitiva. Não tem de/para → diagnóstico.
const unknownHandler: Handler = (draft, value, key) => reject(draft, key, value, 'propriedade sem de/para para o PPTX');

/** Shorthands antes das longhands: `marginTop` vence `margin` qualquer que seja a ordem no objeto. */
const SHORTHANDS: ReadonlySet<string> = new Set(['margin', 'padding', 'inset', 'border', 'borderWidth', 'borderStyle', 'borderColor', 'flex', 'gap', 'placeItems', 'placeSelf', 'background', 'gridColumn', 'gridRow']);

const priorityOf = (key: string): number => (SHORTHANDS.has(key) ? 0 : 1);

const handlerOf = (kind: PrimitiveKind, key: string): Handler => KIND_HANDLERS[kind][key] ?? CSS_HANDLERS[key] ?? unknownHandler;

/** Merge do `style` sobre as props (o que está em style vence, como inline style). */
const entriesOf = (props: Readonly<Record<string, unknown>>): readonly (readonly [string, unknown])[] => {
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
  const width = style === 'none' ? 0 : (draft.width ?? POC_DEFAULTS.borderMediumWidth);
  return { width, style, color: draft.color ?? currentColor, alpha: draft.alpha ?? 1 };
};

const sidesWith = <T>(partial: Partial<Sides<T>>, fallback: T): Sides<T> => ({
  top: partial.top ?? fallback,
  right: partial.right ?? fallback,
  bottom: partial.bottom ?? fallback,
  left: partial.left ?? fallback,
});

const AUTO_PLACEMENT: GridPlacement = { start: { kind: 'auto' }, end: { kind: 'auto' } };

/** Direção padrão: Slide e Box sem display são column (como a engine); `display: flex` explícito é row (CSS). */
const defaultDirectionOf = (kind: PrimitiveKind, draft: Draft): CssFlexDirection =>
  kind === 'box' && draft.display === 'flex' ? POC_DEFAULTS.cssFlexDirection : POC_DEFAULTS.legacyDirection;

const displayOf = (kind: PrimitiveKind, draft: Draft): Display => {
  if (draft.display !== undefined) return draft.display;
  return kind === 'box' || kind === 'slide' ? POC_DEFAULTS.boxDisplay : 'block';
};

const finalize = (kind: PrimitiveKind, draft: Draft, currentColor: string): CssStyle => ({
  display: displayOf(kind, draft),
  position: draft.position ?? 'static',
  inset: draft.inset,
  ...draft.sizes,
  ...(draft.aspectRatio === undefined ? {} : { aspectRatio: draft.aspectRatio }),
  flexDirection: draft.flexDirection ?? defaultDirectionOf(kind, draft),
  flexWrap: draft.flexWrap ?? 'nowrap',
  justifyContent: draft.justifyContent ?? 'flex-start',
  alignItems: draft.alignItems ?? 'stretch',
  alignContent: draft.alignContent ?? 'stretch',
  ...(draft.alignSelf === undefined ? {} : { alignSelf: draft.alignSelf }),
  ...(draft.justifySelf === undefined ? {} : { justifySelf: draft.justifySelf }),
  ...(draft.justifyItems === undefined ? {} : { justifyItems: draft.justifyItems }),
  flexGrow: draft.flexGrow ?? POC_DEFAULTS.flexGrow,
  flexShrink: draft.flexShrink ?? POC_DEFAULTS.flexShrink,
  flexBasis: draft.flexBasis ?? 'auto',
  basisSource: draft.basisSource,
  order: draft.order ?? POC_DEFAULTS.order,
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
  ...(draft.borderRadius === undefined ? {} : { borderRadius: draft.borderRadius }),
  ...(draft.backgroundColor === undefined ? {} : { backgroundColor: draft.backgroundColor }),
  backgroundAlpha: draft.backgroundAlpha ?? 1,
  ...(draft.backgroundImage === undefined ? {} : { backgroundImage: draft.backgroundImage }),
  ...(draft.outline === undefined ? {} : { outline: draft.outline }),
  ...(draft.boxShadow === undefined ? {} : { boxShadow: draft.boxShadow }),
  opacity: draft.opacity ?? POC_DEFAULTS.opacity,
  rotate: draft.rotate,
  translate: draft.translate,
  ...(draft.zIndex === undefined ? {} : { zIndex: draft.zIndex }),
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
  // letterSpacing e textTransform herdam; o resto do css não.
  const css = finalize(kind, { ...draft, text }, text.color ?? DEFAULTS.text.color);
  return { css, text, own: draft.own };
};
