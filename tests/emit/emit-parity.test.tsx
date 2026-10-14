import { describe, expect, it } from 'vitest';
import charts from '../../examples/charts.tsx';
import demo from '../../examples/demo.tsx';
import hello from '../../examples/hello.tsx';
import layoutTest from '../../examples/layout-test.tsx';
import type { DeckDefinition } from '../../src/core/types.ts';
import { emittedXmls } from '../helpers/css-fit.tsx';
import baseline from './__fixtures__/poc-slides.json' with { type: 'json' };

/**
 * M11 (H2, de poc/css/tests/h2-emit-parity.test.tsx): o XML que o motor CSS emite é o da PoC
 * validada (`poc-slides.json`, gravado do commit 05c1e5e em 16x9). Compara as formas de cada
 * slide como multiconjunto, sem ids/nomes/rIds que o pptxgenjs numera pela ordem de inserção:
 * a ordem de pintura muda quando os exemplos ganham `zIndex={-1}` (M11-F), as formas não.
 * Os decks de calibração ficaram de fora: usam `lineHeight` numérico, cuja semântica mudou
 * (CSS); o M11-G os recalibra no Keynote.
 */

const POC = (baseline as { readonly decks: Readonly<Record<string, readonly string[]>> }).decks;

const SHAPE = /<p:(sp|pic|graphicFrame|cxnSp)>[\s\S]*?<\/p:\1>/g;

const shapesOf = (xml: string): readonly string[] =>
  (xml.match(SHAPE) ?? []).map((shape) => shape.replace(/ id="\d+"| name="[^"]*"| r:(id|embed)="[^"]*"/g, '')).sort();

const DECKS: readonly (readonly [string, DeckDefinition])[] = [
  ['hello', hello],
  ['layout-test', layoutTest],
  ['demo', demo],
  ['charts', charts],
];

describe('slide XML × PoC (shapes, any paint order)', () => {
  it.each(DECKS)('%s', async (name, deck) => {
    const expected = POC[name]!;
    const actual = await emittedXmls(deck);
    expect(actual).toHaveLength(expected.length);
    actual.forEach((xml, i) => expect(shapesOf(xml), `slide ${i + 1}`).toEqual(shapesOf(expected[i]!)));
  });
});
