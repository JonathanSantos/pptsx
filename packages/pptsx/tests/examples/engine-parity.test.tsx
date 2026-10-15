import { describe, expect, it } from 'vitest';
import charts from './legacy/charts.tsx';
import demo from './legacy/demo.tsx';
import hello from './legacy/hello.tsx';
import layoutTest from './legacy/layout-test.tsx';
import longList from './legacy/long-list.tsx';
import type { DeckDefinition, SizePresetName } from '../../src/core/types.ts';
import { cssFit, slideDiffs, type BaselineNode } from '../helpers/css-fit.tsx';
import demoBaseline from './__fixtures__/demo-positioned.json' with { type: 'json' };
import engineBaseline from './__fixtures__/engine-positioned.json' with { type: 'json' };

/**
 * M11 (H3, de poc/css/tests/h3-engine-parity.test.tsx): nos decks sem CSS novo (nomes antigos
 * como alias), o motor CSS posiciona como o motor pré-M11 — mesmos nós, frames ±1 pt, mesmo
 * size e número de linhas nos Text — e dá os mesmos diagnósticos. O "motor atual" da PoC não
 * existe mais: a referência é `engine-positioned.json`, gravado do commit 05c1e5e, quando
 * src/ e poc/css/ davam o mesmo resultado nesses decks. Os decks são as cópias congeladas
 * em `legacy/` (examples/ do commit 7bf9fc7, antes do M11-F reescrevê-los em CSS).
 */

interface BaselineDiagnostic {
  readonly severity: string;
  readonly code: string;
  readonly slide: number;
  readonly path: string;
}

const DEMO = demoBaseline as Readonly<Record<string, readonly (readonly BaselineNode[])[]>>;

type EngineSize = { readonly slides: readonly (readonly BaselineNode[])[]; readonly diagnostics: readonly BaselineDiagnostic[] };
const ENGINE = (engineBaseline as unknown as { readonly decks: Readonly<Record<string, Readonly<Record<string, EngineSize>>>> }).decks;

const keyOf = (d: BaselineDiagnostic): string => `${d.severity} ${d.code} s${d.slide} ${d.path}`;

describe('legacy demo × tests/examples/__fixtures__/demo-positioned.json', () => {
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

describe('legacy examples (aliases) × pre-M11 engine, node by node', () => {
  it.each(DECKS.flatMap(([name, deck]) => SIZES.map((size) => [name, size, deck] as const)))('%s %s', (name, size, deck) => {
    const expected = ENGINE[name]![size]!;
    const { positioned, diagnostics } = cssFit(deck, size);
    expect(positioned.slides).toHaveLength(expected.slides.length);
    const diffs = positioned.slides.flatMap((slide, i) => slideDiffs(slide, expected.slides[i]!));
    expect(diffs).toEqual([]);
    expect(diagnostics.map(keyOf)).toEqual(expected.diagnostics.map(keyOf));
  });
});
