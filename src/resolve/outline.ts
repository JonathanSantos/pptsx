import { DEFAULTS } from '../core/defaults.ts';
import { hexOf } from './colors.ts';
import { INVALID, reject } from './draft.ts';
import type { Draft, Handler } from './draft.ts';
import { parseBorder, parsePt } from './values.ts';

/**
 * `outline` do CSS: contorno que não ocupa espaço (mesmo destino do alias `stroke`). O PPTX só
 * tem linha sólida; sem estilo escrito vale sólido (o autor que escreve outline quer vê-lo).
 */

export interface OutlinePart {
  readonly color?: string;
  readonly width?: number;
}

const SOLID_ONLY = 'o PPTX só tem contorno sólido; sai sólido';

/** `'1px solid #ccc'`, número (largura) ou `'none'`; o `reason` acompanha o que não sai igual. */
export const parseOutline = (
  value: unknown,
): { readonly part: OutlinePart | 'none'; readonly reason?: string } | undefined => {
  const parsed = parseBorder(value);
  if (parsed === undefined) return undefined;
  if (parsed.style === 'none') return { part: 'none' };
  const part: OutlinePart = {
    width: parsed.width ?? DEFAULTS.css.borderMediumWidth,
    ...(parsed.color === undefined ? {} : { color: parsed.color.hex }),
  };
  const solid = parsed.style === undefined || parsed.style === 'solid';
  return solid ? { part } : { part, reason: SOLID_ONLY };
};

const withOutline = (draft: Draft, part: OutlinePart): Draft => ({
  ...draft,
  outline: {
    width: part.width ?? draft.outline?.width ?? DEFAULTS.css.borderMediumWidth,
    ...((part.color ?? draft.outline?.color) === undefined ? {} : { color: part.color ?? draft.outline?.color }),
  },
});

const outlineShorthand: Handler = (draft, value, key) => {
  const result = parseOutline(value);
  if (result === undefined) return reject(draft, key, value, INVALID);
  if (result.part === 'none') return { ...draft, outline: undefined };
  const next = withOutline({ ...draft, outline: undefined }, result.part);
  return result.reason === undefined ? next : reject(next, key, value, result.reason);
};

const outlineWidth: Handler = (draft, value, key) => {
  const width = parsePt(value);
  return width === undefined ? reject(draft, key, value, INVALID) : withOutline(draft, { width });
};

const outlineColor: Handler = (draft, value, key) => withOutline(draft, { color: hexOf(key, value) });

export const OUTLINE_HANDLERS: Readonly<Record<string, Handler>> = {
  outline: outlineShorthand,
  outlineWidth,
  outlineColor,
};
