import { describe, expect, it } from 'vitest';
import demo from '../../../examples/demo.tsx';
import hello from '../../../examples/hello.tsx';
import layoutTest from '../../../examples/layout-test.tsx';
import longList from '../../../examples/long-list.tsx';
import charts from '../../../examples/charts.tsx';
import baseline from '../../../tests/examples/__fixtures__/demo-positioned.json' with { type: 'json' };
import type { DeckDefinition, SizePresetName } from '../../../src/core/types.ts';
import { POC_DEFAULTS } from '../defaults.ts';
import { codesOf, engineFit, frameDiffs, nodesOf, pocFit, treeDiffs } from './helpers.ts';

/**
 * H3: onde a PoC e a engine falam a mesma língua (decks sem CSS novo, nomes antigos como
 * açúcar), as posições pós-ajuste batem em ±1 pt e os Text têm o mesmo size e linhas.
 */

interface BaselineNode {
  readonly path: string;
  readonly kind: string;
  readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly fontSize?: number;
  readonly lines?: number;
}

const BASELINE = baseline as Readonly<Record<string, readonly (readonly BaselineNode[])[]>>;

describe('H3 — demo.tsx pela PoC × tests/examples/__fixtures__/demo-positioned.json', () => {
  const sizes = Object.keys(BASELINE) as SizePresetName[];

  it.each(sizes)('%s: mesmos nós, frames ±1 pt, mesmo size e linhas', (size) => {
    const { positioned } = pocFit(demo, size);
    const expected = BASELINE[size]!;
    expect(positioned.slides).toHaveLength(expected.length);
    positioned.slides.forEach((slide, i) => {
      const actual = nodesOf(slide);
      const want = expected[i]!;
      expect(actual.map((n) => `${n.kind} ${n.path}`), `slide ${i + 1}`).toEqual(want.map((n) => `${n.kind} ${n.path}`));
      const diffs = want.flatMap((node, j) => {
        const got = actual[j]!;
        const text =
          got.kind === 'text' && (got.text.fontSize !== node.fontSize || got.text.lines.length !== node.lines)
            ? [`${got.path}: ${node.fontSize}/${node.lines} → ${got.text.fontSize}/${got.text.lines.length}`]
            : [];
        return [...frameDiffs(got.path, node.frame, got.frame, POC_DEFAULTS.frameTolerance), ...text];
      });
      expect(diffs, `slide ${i + 1}`).toEqual([]);
    });
  });
});

const DECKS: readonly (readonly [string, DeckDefinition])[] = [
  ['hello', hello],
  ['layout-test', layoutTest],
  ['demo', demo],
  ['long-list', longList],
  ['charts', charts],
];

const SIZES: readonly SizePresetName[] = ['16x9', '4x3', 'wide'];

describe('H3 — PoC × engine atual, nó a nó, nos exemplos sem CSS novo', () => {
  it.each(DECKS.flatMap(([name, deck]) => SIZES.map((size) => [name, deck, size] as const)))('%s %s', (_name, deck, size) => {
    const poc = pocFit(deck, size);
    const engine = engineFit(deck, size);
    expect(poc.positioned.slides).toHaveLength(engine.positioned.slides.length);
    const diffs = engine.positioned.slides.flatMap((slide, i) => treeDiffs(slide, poc.positioned.slides[i]!));
    expect(diffs).toEqual([]);
    expect(codesOf(poc.diagnostics)).toEqual(codesOf(engine.diagnostics as never));
  });
});
