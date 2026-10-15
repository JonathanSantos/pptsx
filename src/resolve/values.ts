import { canonicalWeightOf, DEFAULTS } from '../core/defaults.ts';
import type { BorderStyle, FontWeight, GridLine, GridPlacement, Len, MarginLen, Shadow, Sides } from '../core/types.ts';

/**
 * Parsers puros de valores CSS (strings como o autor escreve) para valores normalizados.
 * Devolvem undefined quando não entendem: quem chama decide se vira diagnóstico.
 * 'px' vale como pt (o CSS "cola" sem conversão).
 */

const NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const LENGTH = new RegExp(`^(${NUMBER})(px|pt)?$`, 'i');
const PERCENT = new RegExp(`^(${NUMBER})%$`);

export const parseLength = (value: unknown): Len | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  const percent = PERCENT.exec(text);
  if (percent) return `${Number(percent[1])}%`;
  const length = LENGTH.exec(text);
  return length ? Number(length[1]) : undefined;
};

/** Só pt (gap, raio, sombra, letterSpacing): % não tem base nesses lugares. */
export const parsePt = (value: unknown): number | undefined => {
  const length = parseLength(value);
  return typeof length === 'number' ? length : undefined;
};

export const parseMargin = (value: unknown): MarginLen | undefined =>
  typeof value === 'string' && value.trim() === 'auto' ? 'auto' : parseLength(value);

const tokensOf = (value: string): readonly string[] => value.trim().split(/\s+/).filter((token) => token !== '');

/** 1 a 4 valores na ordem do CSS (top, right, bottom, left). */
const sidesFromList = <T>(values: readonly T[]): Sides<T> | undefined => {
  const [a, b = a, c = a, d = b] = values;
  if (a === undefined || b === undefined || c === undefined || d === undefined || values.length > 4) return undefined;
  return { top: a, right: b, bottom: c, left: d };
};

type SideObject = { readonly top?: unknown; readonly right?: unknown; readonly bottom?: unknown; readonly left?: unknown };

const isSideObject = (value: unknown): value is SideObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Shorthand de caixa (`margin`, `padding`, `inset`): número, '8 16', '8px auto 0' ou o
 * objeto da engine ({ top, left }); lados ausentes do objeto ficam de fora (undefined).
 */
export const parseSides = <T>(value: unknown, parse: (item: unknown) => T | undefined): Partial<Sides<T>> | undefined => {
  if (typeof value === 'number') {
    const item = parse(value);
    return item === undefined ? undefined : { top: item, right: item, bottom: item, left: item };
  }
  if (typeof value === 'string') {
    const items = tokensOf(value).map(parse);
    if (items.some((item) => item === undefined)) return undefined;
    return sidesFromList(items as readonly T[]);
  }
  if (!isSideObject(value)) return undefined;
  const entries = (['top', 'right', 'bottom', 'left'] as const).flatMap((side) => {
    const raw = value[side];
    if (raw === undefined) return [];
    const item = parse(raw);
    return item === undefined ? [] : [[side, item] as const];
  });
  return Object.fromEntries(entries) as Partial<Sides<T>>;
};

// ───────────── cor ─────────────

export interface ParsedColor {
  readonly hex: string;
  readonly alpha: number;
}

const NAMED: Readonly<Record<string, string>> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  gray: '#808080',
  grey: '#808080',
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*([^)]+)\)$/i;

const byte = (value: number): string =>
  Math.round(Math.min(DEFAULTS.css.colorChannelMax, Math.max(0, value))).toString(16).padStart(2, '0').toUpperCase();

const expandShortHex = (digits: string): string => [...digits].map((d) => d + d).join('');

const parseHex = (digits: string): ParsedColor => {
  const full = digits.length === 3 ? expandShortHex(digits) : digits;
  const alpha = full.length === 8 ? Number.parseInt(full.slice(6), 16) / DEFAULTS.css.colorChannelMax : 1;
  return { hex: `#${full.slice(0, 6).toUpperCase()}`, alpha };
};

const parseChannel = (token: string): number | undefined => {
  const percent = PERCENT.exec(token);
  if (percent) return (Number(percent[1]) / DEFAULTS.css.percentBase) * DEFAULTS.css.colorChannelMax;
  const number = Number(token);
  return Number.isFinite(number) ? number : undefined;
};

const parseAlpha = (token: string | undefined): number | undefined => {
  if (token === undefined) return 1;
  const percent = PERCENT.exec(token);
  if (percent) return Number(percent[1]) / DEFAULTS.css.percentBase;
  const number = Number(token);
  return Number.isFinite(number) ? number : undefined;
};

const parseRgb = (body: string): ParsedColor | undefined => {
  const parts = body.split(/[\s,/]+/).filter((part) => part !== '');
  const [r, g, b, a] = parts;
  if (r === undefined || g === undefined || b === undefined || parts.length > 4) return undefined;
  const channels = [r, g, b].map(parseChannel);
  const alpha = parseAlpha(a);
  if (channels.some((channel) => channel === undefined) || alpha === undefined) return undefined;
  return { hex: `#${(channels as number[]).map(byte).join('')}`, alpha };
};

export const parseColor = (value: unknown): ParsedColor | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return { hex: '#000000', alpha: 0 };
  const named = NAMED[text];
  if (named !== undefined) return { hex: named, alpha: 1 };
  const hex = HEX.exec(text);
  if (hex?.[1] !== undefined) return parseHex(hex[1]);
  const rgb = RGB.exec(text);
  return rgb?.[1] === undefined ? undefined : parseRgb(rgb[1]);
};

// ───────────── borda ─────────────

export interface ParsedBorder {
  readonly width?: number;
  readonly style?: BorderStyle;
  readonly color?: ParsedColor;
}

const BORDER_STYLES: readonly BorderStyle[] = ['solid', 'dashed', 'dotted', 'none'];

const isBorderStyle = (token: string): token is BorderStyle => (BORDER_STYLES as readonly string[]).includes(token);

/** `2px solid #2F6FED`, `1 dashed`, `none` ou só a largura (número). Ordem livre, como no CSS. */
export const parseBorder = (value: unknown): ParsedBorder | undefined => {
  if (typeof value === 'number') return { width: value, style: 'solid' };
  if (typeof value !== 'string') return undefined;
  // rgba(…) tem espaços: protege os parênteses antes de quebrar em tokens.
  const tokens = value.trim().match(/[a-z]+\([^)]*\)|\S+/gi) ?? [];
  return tokens.reduce<ParsedBorder | undefined>((acc, token) => {
    if (acc === undefined) return undefined;
    const lower = token.toLowerCase();
    if (isBorderStyle(lower)) return { ...acc, style: lower };
    const width = parsePt(token);
    if (width !== undefined) return { ...acc, width };
    const color = parseColor(token);
    return color === undefined ? undefined : { ...acc, color };
  }, {});
};

export const parseBorderStyle = (value: unknown): BorderStyle | undefined =>
  typeof value === 'string' && isBorderStyle(value.trim().toLowerCase()) ? (value.trim().toLowerCase() as BorderStyle) : undefined;

// ───────────── sombra ─────────────

/** `x y [blur [spread]] color [inset]`; só a primeira sombra de uma lista (o PPTX tem uma). */
export const parseShadow = (value: unknown): { readonly shadow: Shadow; readonly extra: boolean } | undefined => {
  if (typeof value !== 'string' || value.trim() === 'none') return undefined;
  const layers = value.split(/,(?![^(]*\))/);
  const [first] = layers;
  if (first === undefined) return undefined;
  const tokens = first.trim().match(/[a-z]+\([^)]*\)|\S+/gi) ?? [];
  const inset = tokens.some((token) => token.toLowerCase() === 'inset');
  const lengths = tokens.map(parsePt).filter((length): length is number => length !== undefined);
  const color = tokens.map(parseColor).find((parsed) => parsed !== undefined) ?? { hex: '#000000', alpha: 1 };
  const [x, y, blur = 0, spread = 0] = lengths;
  if (x === undefined || y === undefined) return undefined;
  return { shadow: { x, y, blur, spread, color: color.hex, alpha: color.alpha, inset }, extra: layers.length > 1 };
};

// ───────────── flex ─────────────

export interface ParsedFlex {
  readonly grow: number;
  readonly shrink: number;
  readonly basis: Len | 'auto';
  /** `flex: n` (basis 0 implícito) — distinto de basis 0 escrito pelo autor. */
  readonly implicitZero: boolean;
}

const isNumberToken = (token: string): boolean => new RegExp(`^${NUMBER}$`).test(token);

/** `flex: 1`, `flex: 'auto'`, `'none'`, `'1 0 120px'`, `'2 1'`. */
export const parseFlex = (value: unknown): ParsedFlex | undefined => {
  if (typeof value === 'number') return { grow: value, shrink: 1, basis: 0, implicitZero: true };
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === 'auto') return { grow: 1, shrink: 1, basis: 'auto', implicitZero: false };
  if (text === 'none') return { grow: 0, shrink: 0, basis: 'auto', implicitZero: false };
  const tokens = tokensOf(text);
  const numbers = tokens.filter(isNumberToken).map(Number);
  const basisToken = tokens.find((token) => !isNumberToken(token));
  const basis = basisToken === undefined ? undefined : basisToken === 'auto' ? 'auto' : parseLength(basisToken);
  const [grow, shrink = 1] = numbers;
  if (grow === undefined || numbers.length > 2 || (basisToken !== undefined && basis === undefined)) return undefined;
  return { grow, shrink, basis: basis ?? 0, implicitZero: basis === undefined };
};

// ───────────── transform ─────────────

const ANGLE = new RegExp(`^(${NUMBER})(deg|turn|rad)?$`, 'i');

const ANGLE_FACTORS: Readonly<Record<string, number>> = {
  deg: 1,
  turn: DEFAULTS.css.degreesPerTurn,
  rad: DEFAULTS.css.radiansToDegrees,
};

export const parseAngle = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const match = ANGLE.exec(value.trim());
  if (!match) return undefined;
  return Number(match[1]) * (ANGLE_FACTORS[(match[2] ?? 'deg').toLowerCase()] ?? 1);
};

export interface ParsedTransform {
  readonly rotate: number;
  readonly translate: { readonly x: number; readonly y: number };
  /** Funções sem de/para (scale, skew, matrix…), como o autor escreveu. */
  readonly unsupported: readonly string[];
}

const FUNCTION = /([a-zA-Z]+)\(([^)]*)\)/g;

const argsOf = (body: string): readonly string[] => body.split(/[\s,]+/).filter((arg) => arg !== '');

type TransformStep = (acc: ParsedTransform, args: readonly string[], raw: string) => ParsedTransform;

const unsupported: TransformStep = (acc, _args, raw) => ({ ...acc, unsupported: [...acc.unsupported, raw] });

const TRANSFORMS: Readonly<Record<string, TransformStep>> = {
  rotate: (acc, [angle], raw) => {
    const degrees = parseAngle(angle);
    return degrees === undefined ? unsupported(acc, [], raw) : { ...acc, rotate: acc.rotate + degrees };
  },
  translate: (acc, [x, y = '0'], raw) => {
    const dx = parsePt(x);
    const dy = parsePt(y);
    if (dx === undefined || dy === undefined) return unsupported(acc, [], raw);
    return { ...acc, translate: { x: acc.translate.x + dx, y: acc.translate.y + dy } };
  },
  translateX: (acc, [x], raw) => TRANSFORMS.translate!(acc, [x ?? '', '0'], raw),
  translateY: (acc, [y], raw) => TRANSFORMS.translate!(acc, ['0', y ?? ''], raw),
};

export const parseTransform = (value: unknown): ParsedTransform | undefined => {
  if (typeof value !== 'string') return undefined;
  const empty: ParsedTransform = { rotate: 0, translate: { x: 0, y: 0 }, unsupported: [] };
  if (value.trim() === 'none') return empty;
  return [...value.matchAll(FUNCTION)].reduce<ParsedTransform>((acc, match) => {
    const [raw, name = '', body = ''] = match;
    const step = TRANSFORMS[name] ?? unsupported;
    return step(acc, argsOf(body), raw);
  }, empty);
};

// ───────────── grid ─────────────

const AUTO_LINE: GridLine = { kind: 'auto' };

export const parseGridLine = (value: unknown): GridLine | undefined => {
  if (value === undefined) return AUTO_LINE;
  if (typeof value === 'number') return Number.isInteger(value) && value !== 0 ? { kind: 'line', index: value } : undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === 'auto') return AUTO_LINE;
  const span = /^span\s+(\d+)$/.exec(text);
  if (span) return Number(span[1]) > 0 ? { kind: 'span', count: Number(span[1]) } : undefined;
  return isNumberToken(text) ? parseGridLine(Number(text)) : undefined;
};

/** `gridColumn: '1 / 3'`, `'span 2'`, `'2'`, `'1 / -1'`, número. */
export const parseGridPlacement = (value: unknown): GridPlacement | undefined => {
  if (value === undefined) return { start: AUTO_LINE, end: AUTO_LINE };
  if (typeof value === 'number') {
    const start = parseGridLine(value);
    return start === undefined ? undefined : { start, end: AUTO_LINE };
  }
  if (typeof value !== 'string') return undefined;
  const [startText, endText, ...rest] = value.split('/');
  if (rest.length > 0) return undefined;
  const start = parseGridLine(startText);
  const end = endText === undefined ? AUTO_LINE : parseGridLine(endText);
  return start === undefined || end === undefined ? undefined : { start, end };
};

// ───────────── texto ─────────────

const MIN_WEIGHT = 1;
const MAX_WEIGHT = 1000;

/**
 * M13: `bold`, `normal`/`regular` ou número de 1 a 1000 (CSS Fonts 4), já na forma canônica
 * (400 → 'regular', 700 → 'bold'). A face usada é escolhida na medição.
 */
export const parseFontWeight = (value: unknown): FontWeight | undefined => {
  if (value === 'bold') return 'bold';
  if (value === 'normal' || value === 'regular') return 'regular';
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && isNumberToken(value) ? Number(value) : undefined;
  if (numeric === undefined || !Number.isFinite(numeric) || numeric < MIN_WEIGHT || numeric > MAX_WEIGHT) return undefined;
  return canonicalWeightOf(numeric);
};
