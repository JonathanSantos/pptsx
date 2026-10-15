import { describe, expect, it } from 'vitest';
import m9 from '../../examples/agent-test/m9-deck.tsx';
import charts from '../../examples/charts.tsx';
import demo from '../../examples/demo.tsx';
import hello from '../../examples/hello.tsx';
import layoutTest from '../../examples/layout-test.tsx';
import longList from '../../examples/long-list.tsx';
import showcase from '../../examples/showcase.tsx';
import type { DeckDefinition, SizePresetName } from '../../src/core/types.ts';
import { EXAMPLES_DIR, cssFit, slideDiffs, type BaselineNode } from '../helpers/css-fit.tsx';
import baseline from './__fixtures__/css-positioned.json' with { type: 'json' };

/**
 * M11: os decks de examples/ escritos em CSS (M11-F) × `css-positioned.json`, a referência de
 * posições daqui para frente: mesmos nós, frames ±1 pt, mesmo size e linhas, mesmos diagnósticos.
 * A paridade com o motor pré-M11 fica em engine-parity (decks legados, props antigas).
 */

interface BaselineDiagnostic {
  readonly severity: string;
  readonly code: string;
  readonly slide: number;
  readonly path: string;
}

type CssSize = { readonly slides: readonly (readonly BaselineNode[])[]; readonly diagnostics: readonly BaselineDiagnostic[] };
const CSS = (baseline as unknown as { readonly decks: Readonly<Record<string, Readonly<Record<string, CssSize>>>> }).decks;

const keyOf = (d: BaselineDiagnostic): string => `${d.severity} ${d.code} s${d.slide} ${d.path}`;

const DECKS: readonly (readonly [string, DeckDefinition, string])[] = [
  ['hello', hello, EXAMPLES_DIR],
  ['layout-test', layoutTest, EXAMPLES_DIR],
  ['demo', demo, EXAMPLES_DIR],
  ['long-list', longList, EXAMPLES_DIR],
  ['charts', charts, EXAMPLES_DIR],
  ['agent-test/m9-deck', m9, `${EXAMPLES_DIR}agent-test/`],
  ['showcase', showcase, EXAMPLES_DIR],
];

const SIZES: readonly SizePresetName[] = ['16x9', '4x3', 'wide'];

describe('CSS examples × tests/examples/__fixtures__/css-positioned.json', () => {
  it('fixture covers every deck and size', () => {
    expect(Object.keys(CSS)).toEqual(DECKS.map(([name]) => name));
    for (const [name] of DECKS) expect(Object.keys(CSS[name]!)).toEqual(SIZES);
  });

  it.each(DECKS.flatMap(([name, deck, baseDir]) => SIZES.map((size) => [name, size, deck, baseDir] as const)))(
    '%s %s',
    (name, size, deck, baseDir) => {
      const expected = CSS[name]![size]!;
      const { positioned, diagnostics } = cssFit(deck, size, baseDir);
      expect(positioned.slides).toHaveLength(expected.slides.length);
      positioned.slides.forEach((slide, i) => expect(slideDiffs(slide, expected.slides[i]!), `slide ${i + 1}`).toEqual([]));
      expect(diagnostics.map(keyOf)).toEqual(expected.diagnostics.map(keyOf));
    },
  );
});
