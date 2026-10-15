import type {
  CssAlign,
  CssAlignContent,
  CssFlexDirection,
  CssFlexWrap,
  CssJustify,
  CssPlace,
  CssPosition,
  Display,
  TextAlign,
  TextDecoration,
  TextTransform,
} from '../core/types.ts';

/** Vocabulário de palavras-chave CSS; aceita também os nomes antigos da engine ('start', 'between'). */

const oneOf =
  <T extends string>(options: readonly T[], aliases: Readonly<Record<string, T>> = {}) =>
  (value: unknown): T | undefined => {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return aliases[text] ?? ((options as readonly string[]).includes(text) ? (text as T) : undefined);
  };

const ALIGN_ALIASES: Readonly<Record<string, CssAlign>> = { start: 'flex-start', end: 'flex-end' };
const JUSTIFY_ALIASES: Readonly<Record<string, CssJustify>> = {
  start: 'flex-start',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

export const parseAlign = oneOf<CssAlign>(['flex-start', 'center', 'flex-end', 'stretch', 'baseline'], ALIGN_ALIASES);
export const parseJustify = oneOf<CssJustify>(
  ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  JUSTIFY_ALIASES,
);
export const parseAlignContent = oneOf<CssAlignContent>(
  ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'stretch'],
  JUSTIFY_ALIASES,
);
export const parsePlace = oneOf<CssPlace>(['start', 'center', 'end', 'stretch'], { 'flex-start': 'start', 'flex-end': 'end' });
export const parseDirection = oneOf<CssFlexDirection>(['row', 'column', 'row-reverse', 'column-reverse']);
export const parseWrap = oneOf<CssFlexWrap>(['nowrap', 'wrap', 'wrap-reverse']);
export const parseDisplay = oneOf<Display>(['flex', 'block', 'grid', 'none']);
export const parsePosition = oneOf<CssPosition>(['static', 'relative', 'absolute']);
export const parseTextAlign = oneOf<TextAlign>(['left', 'center', 'right'], { start: 'left', end: 'right' });
export const parseTextTransform = oneOf<TextTransform>(['none', 'uppercase', 'lowercase', 'capitalize']);

const DECORATION_TOKENS: readonly string[] = ['none', 'underline', 'line-through'];

export const parseDecoration = (value: unknown): TextDecoration | undefined => {
  if (typeof value !== 'string') return undefined;
  const tokens = value.trim().split(/\s+/);
  if (tokens.some((token) => !DECORATION_TOKENS.includes(token))) return undefined;
  return { underline: tokens.includes('underline'), lineThrough: tokens.includes('line-through') };
};
