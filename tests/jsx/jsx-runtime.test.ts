import { describe, expect, it, vi } from 'vitest';
import { Fragment, jsx, jsxs } from '../../src/jsx/jsx-runtime.ts';
import { Fragment as DevFragment, jsxDEV } from '../../src/jsx/jsx-dev-runtime.ts';
import { FRAGMENT } from '../../src/core/types.ts';
import { Box, Text } from '../../src/primitives/index.ts';

describe('jsx()', () => {
  it('creates an element with type, props and key', () => {
    const el = jsx(Box, { width: 10 }, 'k1');
    expect(el.type).toBe(Box);
    expect(el.props).toEqual({ width: 10 });
    expect(el.key).toBe('k1');
  });

  it('leaves key undefined when none is given', () => {
    const el = jsx(Box, { width: 10 });
    expect(el.key).toBeUndefined();
  });

  it('returns a frozen element', () => {
    const el = jsx(Box, {});
    expect(Object.isFrozen(el)).toBe(true);
  });

  it('never calls a component', () => {
    const Component = vi.fn(() => jsx(Box, {}));
    const el = jsx(Component, { title: 'x' });
    expect(Component).not.toHaveBeenCalled();
    expect(el.type).toBe(Component);
    expect(el.props).toEqual({ title: 'x' });
  });

  it('preserves a single child as-is in props.children', () => {
    const child = jsx(Text, { children: 'hi' });
    const el = jsx(Box, { children: child });
    expect(el.props.children).toBe(child);
  });

  it('preserves an array of children (jsxs) including primitives values and nulls', () => {
    const a = jsx(Text, { children: 'a' });
    const children = [a, 'str', 3, null, false];
    const el = jsxs(Box, { children });
    expect(el.props.children).toEqual(children);
    expect((el.props.children as unknown[])[0]).toBe(a);
  });
});

describe('Fragment', () => {
  it('is the FRAGMENT symbol from core/types', () => {
    expect(Fragment).toBe(FRAGMENT);
  });

  it('is re-exported by the dev runtime', () => {
    expect(DevFragment).toBe(FRAGMENT);
  });

  it('can be used as an element type', () => {
    const el = jsx(Fragment, { children: [jsx(Box, {})] });
    expect(el.type).toBe(FRAGMENT);
  });
});

describe('jsxDEV()', () => {
  it('creates the same element shape as jsx()', () => {
    const el = jsxDEV(Box, { width: 1 }, 'k');
    expect(el.type).toBe(Box);
    expect(el.props).toEqual({ width: 1 });
    expect(el.key).toBe('k');
  });
});
