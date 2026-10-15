import { finiteNumber, INVALID, reject, setField, setText } from './draft.ts';
import type { Handler } from './draft.ts';
import { parseDecoration, parseTextAlign, parseTextTransform } from './keywords.ts';
import { colorHandler } from './paint-handlers.ts';
import { parseFontWeight, parsePt } from './values.ts';

/** Handlers das propriedades de texto (as herdadas descem pelo `draft.text`). */

/** Primeira família de uma lista CSS, sem aspas ('"Inter", Arial' → 'Inter'). */
export const parseFontFamily = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const [first = ''] = value.split(',');
  return first.trim().replace(/^['"]|['"]$/g, '');
};

export const fontWeight: Handler = (draft, value, key) => {
  const weight = parseFontWeight(value);
  if (weight === undefined) return reject(draft, key, value, 'use bold, normal ou um número de 1 a 1000');
  return { ...draft, text: { ...draft.text, weight } };
};

const fontStyle: Handler = (draft, value, key) => {
  if (value === 'italic' || value === 'normal') return { ...draft, text: { ...draft.text, italic: value === 'italic' } };
  return reject(draft, key, value, INVALID);
};

// Semântica CSS (decisão M11): 'normal' = altura natural da face; número = múltiplo do fontSize.
const lineHeight: Handler = (draft, value, key) => {
  if (value === 'normal') return { ...draft, text: { ...draft.text, lineHeight: 'normal' } };
  const number = finiteNumber(value);
  if (typeof value === 'number' && number !== undefined && number > 0) {
    return { ...draft, text: { ...draft.text, lineHeight: number } };
  }
  return reject(draft, key, value, 'só número (múltiplo do fontSize) ou "normal"');
};

export const whiteSpace: Handler = (draft, value, key) => {
  if (value === 'nowrap' || value === 'normal') return { ...draft, own: { ...draft.own, nowrap: value === 'nowrap' } };
  return reject(draft, key, value, 'só normal e nowrap');
};

export const TEXT_HANDLERS: Readonly<Record<string, Handler>> = {
  fontFamily: setText('fontFamily', parseFontFamily),
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
