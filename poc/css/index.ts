import type { DeckDefinition } from '../../src/core/types.ts';

/** API da PoC: mesmas primitivas, props CSS; render() com o motor CSS em memória. */
export { Deck, Slide, Box, Text, Image, Shape, Chart, Table, Span, B, I } from './primitives.ts';
export { Fragment } from '../../src/jsx/jsx-runtime.ts';
export { render, fitSize, createEnv } from './render.ts';
export { resolveDeck } from './resolve/index.ts';

export const defineDeck = (fn: DeckDefinition): DeckDefinition => fn;

export type { DeckContext, Responsive } from '../../src/core/types.ts';
export type * from './css-props.ts';
