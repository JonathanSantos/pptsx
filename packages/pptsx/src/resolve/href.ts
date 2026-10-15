import { InvalidPropError } from './errors.ts';

/**
 * M13: `href` = URL (`https:`, `mailto:`…) ou `slide:N` (N = slide do autor, base 1). A validação
 * aqui é de forma; se o slide N existe só se sabe com o deck inteiro (o fit emite link-target-missing).
 */

const SLIDE = /^slide:(\d+)$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export const parseHref = (key: string, value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new InvalidPropError(key, value, 'use uma URL ("https://…", "mailto:…") ou "slide:N"');
  const href = value.trim();
  if (href.startsWith('slide:')) {
    const match = SLIDE.exec(href);
    if (match === null || Number(match[1]) < 1) throw new InvalidPropError(key, value, 'use "slide:N" com N ≥ 1 (o número do slide no seu <Deck>)');
    return href;
  }
  if (!SCHEME.test(href)) throw new InvalidPropError(key, value, 'a URL precisa do esquema ("https://…", "mailto:…") ou use "slide:N"');
  return href;
};

/** Número do slide de um `slide:N`; undefined para URL. */
export const slideOfHref = (href: string): number | undefined => {
  const match = SLIDE.exec(href);
  return match === null ? undefined : Number(match[1]);
};
