import { describe, expect, it } from 'vitest';
import * as api from '../src/index.ts';
import { FRAGMENT, type DeckDefinition } from '../src/core/types.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../src/primitives/index.ts';

describe('public API (src/index.ts)', () => {
  it('re-exports the primitives', () => {
    expect(api.Deck).toBe(Deck);
    expect(api.Slide).toBe(Slide);
    expect(api.Box).toBe(Box);
    expect(api.Text).toBe(Text);
    expect(api.Image).toBe(Image);
    expect(api.Shape).toBe(Shape);
  });

  it('re-exports Fragment as the FRAGMENT symbol', () => {
    expect(api.Fragment).toBe(FRAGMENT);
  });

  it('defineDeck is the identity function', () => {
    const fn: DeckDefinition = () => Deck({});
    expect(api.defineDeck(fn)).toBe(fn);
  });

  it('exports render as a function', () => {
    expect(typeof api.render).toBe('function');
  });
});
