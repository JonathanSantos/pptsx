import { describe, expect, it, vi } from 'vitest';
import { FRAGMENT, type SlideElement } from '../../src/core/types.ts';
import { Box, Text } from '../../src/primitives/index.ts';

describe('TSX syntax through the automatic runtime', () => {
  it('compiles a primitive tag into an element', () => {
    const el = <Box width={10} />;
    expect(el.type).toBe(Box);
    expect(el.props).toEqual({ width: 10 });
  });

  it('passes children through props', () => {
    const el = (
      <Box>
        <Text>a</Text>
        <Text>b</Text>
      </Box>
    );
    expect(Array.isArray(el.props.children)).toBe(true);
    expect((el.props.children as SlideElement[]).map((c) => c.props.children)).toEqual(['a', 'b']);
  });

  it('keeps the key separate from props', () => {
    const el = <Box key="x" width={1} />;
    expect(el.key).toBe('x');
    expect(el.props).not.toHaveProperty('key');
  });

  it('compiles <></> into a FRAGMENT element', () => {
    const el = (
      <>
        <Box />
      </>
    );
    expect(el.type).toBe(FRAGMENT);
  });

  it('does not call components while building the tree', () => {
    const spy = vi.fn((_: { label: string }) => <Box />);
    const Comp = (props: { label: string }) => spy(props);
    const el = <Comp label="x" />;
    expect(spy).not.toHaveBeenCalled();
    expect(el.type).toBe(Comp);
  });
});
