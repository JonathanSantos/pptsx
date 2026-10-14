import type { DeckContext } from 'pptsx';

/** Altura do 16:9 de referência (pt): usada quando o layout não recebe ctx. */
const REFERENCE_HEIGHT = 405;

/**
 * Diâmetro em pt de uma elipse decorativa circular, proporcional à altura do slide.
 * Width/height em % seguiriam eixos diferentes e virariam um "ovo" fora do 16:9;
 * o mesmo número nos dois eixos garante o círculo em qualquer proporção.
 */
export const circleDiameter = (ctx: Pick<DeckContext, 'height'> | undefined, fraction: number): number =>
  (ctx?.height ?? REFERENCE_HEIGHT) * fraction;
