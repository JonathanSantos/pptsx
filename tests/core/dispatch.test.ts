import { describe, expect, it } from 'vitest';
import { dispatch, type DispatchTable } from '../../src/core/dispatch.ts';

/** core/dispatch (M7-0): tabela por `kind` tipada; o único cast fica dentro de dispatch. */

interface Circle {
  readonly kind: 'circle';
  readonly radius: number;
}
interface Square {
  readonly kind: 'square';
  readonly side: number;
}
interface Label {
  readonly kind: 'label';
  readonly text: string;
}
type Shape = Circle | Square | Label;

const describeTable: DispatchTable<Shape, string, [prefix: string, scale: number]> = {
  circle: (node, prefix, scale) => `${prefix}circle:${node.radius * scale}`,
  square: (node, prefix, scale) => `${prefix}square:${node.side * scale}`,
  label: (node, prefix) => `${prefix}label:${node.text}`,
};

const areaTable: DispatchTable<Shape, number> = {
  circle: (node) => node.radius * node.radius * 3,
  square: (node) => node.side * node.side,
  label: () => 0,
};

describe('dispatch', () => {
  it('calls the entry of the node kind with the node and the extras', () => {
    const shapes: readonly Shape[] = [
      { kind: 'circle', radius: 2 },
      { kind: 'square', side: 3 },
      { kind: 'label', text: 'oi' },
    ];
    expect(shapes.map((shape) => dispatch(describeTable, shape, '> ', 10))).toEqual([
      '> circle:20',
      '> square:30',
      '> label:oi',
    ]);
  });

  it('works without extras', () => {
    expect(dispatch(areaTable, { kind: 'square', side: 4 } as Shape)).toBe(16);
    expect(dispatch(areaTable, { kind: 'label', text: '' } as Shape)).toBe(0);
  });

  it('passes the very same node object and calls exactly one entry', () => {
    const calls: string[] = [];
    const node: Shape = { kind: 'circle', radius: 1 };
    const table: DispatchTable<Shape, Shape> = {
      circle: (n) => (calls.push('circle'), n),
      square: (n) => (calls.push('square'), n),
      label: (n) => (calls.push('label'), n),
    };
    expect(dispatch(table, node)).toBe(node);
    expect(calls).toEqual(['circle']);
  });
});

/** Testes de tipo: verificados pelo `npm run typecheck` (o corpo nunca precisa rodar). */
describe('dispatch — types', () => {
  it('an incomplete table does not compile', () => {
    // @ts-expect-error falta a entrada 'label'
    const incomplete: DispatchTable<Shape, number> = {
      circle: (node) => node.radius,
      square: (node) => node.side,
    };
    expect(Object.keys(incomplete)).toHaveLength(2);
  });

  it('an entry receives the narrowed node (wrong field does not compile)', () => {
    const table: DispatchTable<Shape, number> = {
      // @ts-expect-error Circle não tem `side`
      circle: (node) => node.side,
      square: (node) => node.side,
      label: () => 0,
    };
    expect(Object.keys(table)).toHaveLength(3);
  });

  it('a node whose kind is not in the table does not compile', () => {
    const triangle = { kind: 'triangle', base: 1 } as const;
    const run = () =>
      // @ts-expect-error 'triangle' não é um kind de Shape
      dispatch(areaTable, triangle);
    expect(typeof run).toBe('function');
  });

  it('extras with the wrong type do not compile', () => {
    const run = () =>
      // @ts-expect-error scale precisa ser number
      dispatch(describeTable, { kind: 'circle', radius: 1 } as Shape, '>', 'x');
    expect(typeof run).toBe('function');
  });
});
