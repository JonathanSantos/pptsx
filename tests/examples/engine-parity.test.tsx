import { describe, expect, it } from 'vitest';
import charts from '../../examples/charts.tsx';
import demo from '../../examples/demo.tsx';
import hello from '../../examples/hello.tsx';
import layoutTest from '../../examples/layout-test.tsx';
import longList from '../../examples/long-list.tsx';
import type { DeckDefinition, PositionedNode, PositionedSlide, Rect, SizePresetName } from '../../src/core/types.ts';
import { cssFit, frameDiffs, nodesOf } from '../helpers/css-fit.tsx';
import demoBaseline from './__fixtures__/demo-positioned.json' with { type: 'json' };
import engineBaseline from './__fixtures__/engine-positioned.json' with { type: 'json' };

/**
 * M11 (H3, de poc/css/tests/h3-engine-parity.test.tsx): nos decks sem CSS novo (nomes antigos
 * como alias), o motor CSS posiciona como o motor pré-M11 — mesmos nós, frames ±1 pt, mesmo
 * size e número de linhas nos Text — e dá os mesmos diagnósticos. O "motor atual" da PoC não
 * existe mais: a referência é `engine-positioned.json`, gravado do commit 05c1e5e, quando
 * src/ e poc/css/ davam o mesmo resultado nesses decks.
 */

interface BaselineNode {
  readonly path: string;
  readonly kind: string;
  readonly frame: Rect;
  readonly fontSize?: number;
  readonly lines?: number;
}

interface BaselineDiagnostic {
  readonly severity: string;
  readonly code: string;
  readonly slide: number;
  readonly path: string;
}

const DEMO = demoBaseline as Readonly<Record<string, readonly (readonly BaselineNode[])[]>>;

type CompactNode = Omit<BaselineNode, 'frame'> & { readonly frame: readonly number[] };
type EngineSize = { readonly slides: readonly (readonly CompactNode[])[]; readonly diagnostics: readonly BaselineDiagnostic[] };
const ENGINE = (engineBaseline as unknown as { readonly decks: Readonly<Record<string, Readonly<Record<string, EngineSize>>>> }).decks;

const rectOf = ([x = 0, y = 0, width = 0, height = 0]: readonly number[]): Rect => ({ x, y, width, height });

const keyOf = (d: BaselineDiagnostic): string => `${d.severity} ${d.code} s${d.slide} ${d.path}`;

/** Diferenças de um slide contra a referência; [] quando bate. */
const slideDiffs = (slide: PositionedSlide, want: readonly BaselineNode[]): readonly string[] => {
  const actual = nodesOf(slide);
  const shape = (nodes: readonly { readonly kind: string; readonly path: string }[]) => nodes.map((n) => `${n.kind} ${n.path}`).join('\n');
  if (shape(actual) !== shape(want)) return [`structure:\n${shape(want)}\n×\n${shape(actual)}`];
  return want.flatMap((node, j) => {
    const got = actual[j] as PositionedNode | PositionedSlide;
    const text =
      got.kind === 'text' && (got.text.fontSize !== node.fontSize || got.text.lines.length !== node.lines)
        ? [`${got.path}: ${node.fontSize}/${node.lines} → ${got.text.fontSize}/${got.text.lines.length}`]
        : [];
    return [...frameDiffs(got.path, node.frame, got.frame), ...text];
  });
};

describe('demo.tsx × tests/examples/__fixtures__/demo-positioned.json', () => {
  it.each(Object.keys(DEMO) as SizePresetName[])('%s: same nodes, frames ±1 pt, same size and lines', (size) => {
    const { positioned } = cssFit(demo, size);
    const expected = DEMO[size]!;
    expect(positioned.slides).toHaveLength(expected.length);
    positioned.slides.forEach((slide, i) => expect(slideDiffs(slide, expected[i]!), `slide ${i + 1}`).toEqual([]));
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

describe('examples without new CSS × pre-M11 engine, node by node', () => {
  it.each(DECKS.flatMap(([name, deck]) => SIZES.map((size) => [name, size, deck] as const)))('%s %s', (name, size, deck) => {
    const expected = ENGINE[name]![size]!;
    const { positioned, diagnostics } = cssFit(deck, size);
    expect(positioned.slides).toHaveLength(expected.slides.length);
    const diffs = positioned.slides.flatMap((slide, i) =>
      slideDiffs(slide, expected.slides[i]!.map((node) => ({ ...node, frame: rectOf(node.frame) }))),
    );
    expect(diffs).toEqual([]);
    expect(diagnostics.map(keyOf)).toEqual(expected.diagnostics.map(keyOf));
  });
});
