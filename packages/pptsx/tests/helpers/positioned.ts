/** Navegação e asserts sobre árvores posicionadas. */
import { expect } from 'vitest';
import type { PositionedNode, PositionedSlide, Rect } from '../../src/core/types.ts';

type WithChildren = { readonly children?: readonly PositionedNode[] };

/** Desce pelos índices a partir do slide: child(slide, 0, 1) = segundo filho do primeiro filho. */
export const child = (slide: PositionedSlide, ...indices: number[]): PositionedNode => {
  let node: WithChildren = slide;
  let found: PositionedNode | undefined;
  for (const i of indices) {
    found = node.children?.[i];
    if (!found) throw new Error(`no child at ${indices.join('.')}`);
    node = found as WithChildren;
  }
  if (!found) throw new Error('no indices');
  return found;
};

/** Compara frames com tolerância (Yoga trabalha em float). */
export const expectFrame = (actual: Rect, expected: Rect, digits = 3): void => {
  expect(actual.x, 'x').toBeCloseTo(expected.x, digits);
  expect(actual.y, 'y').toBeCloseTo(expected.y, digits);
  expect(actual.width, 'width').toBeCloseTo(expected.width, digits);
  expect(actual.height, 'height').toBeCloseTo(expected.height, digits);
};

/** Árvore reduzida a path/kind/frame arredondado — boa para snapshot. */
export interface FrameTree {
  readonly kind: string;
  readonly path: string;
  readonly frame: readonly [number, number, number, number];
  readonly lines?: readonly string[];
  readonly children?: readonly FrameTree[];
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

export const frameTree = (node: PositionedSlide | PositionedNode): FrameTree => {
  const { x, y, width, height } = node.frame;
  const base = { kind: node.kind, path: node.path, frame: [round(x), round(y), round(width), round(height)] as const };
  if (node.kind === 'text') return { ...base, lines: node.text.lines };
  if (node.kind === 'slide' || node.kind === 'box') return { ...base, children: node.children.map(frameTree) };
  return base;
};
