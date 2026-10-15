import { describe, expect, it } from 'vitest';
import { FRAGMENT, PRIMITIVE_KIND } from '../../src/core/types.ts';
import { Box, Deck, Image, Shape, Slide, Text, definePrimitive, isPrimitive } from '../../src/primitives/index.ts';

const ALL = [
  ['deck', Deck],
  ['slide', Slide],
  ['box', Box],
  ['text', Text],
  ['image', Image],
  ['shape', Shape],
] as const;

describe('primitives', () => {
  it.each(ALL)('%s carries its kind under PRIMITIVE_KIND', (kind, primitive) => {
    expect(primitive[PRIMITIVE_KIND]).toBe(kind);
  });

  it.each(ALL)('isPrimitive recognizes %s', (_kind, primitive) => {
    expect(isPrimitive(primitive)).toBe(true);
  });

  it('isPrimitive rejects user components', () => {
    const Card = () => null;
    expect(isPrimitive(Card)).toBe(false);
  });

  it.each([['box'], ['Box'], [FRAGMENT], [null], [undefined], [42], [{}]])('isPrimitive rejects %s', (value) => {
    expect(isPrimitive(value)).toBe(false);
  });

  it('definePrimitive creates a recognizable primitive of the given kind', () => {
    const P = definePrimitive('box');
    expect(isPrimitive(P)).toBe(true);
    expect(P[PRIMITIVE_KIND]).toBe('box');
  });

  it('calling a primitive as a function returns an element of that primitive', () => {
    const el = Box({ width: 10, fill: '#ff0000' });
    expect(el.type).toBe(Box);
    expect(el.props).toEqual({ width: 10, fill: '#ff0000' });
  });

  it('calling Text as a function keeps children in props', () => {
    const el = Text({ children: 'hello' });
    expect(el.type).toBe(Text);
    expect(el.props.children).toBe('hello');
  });
});
