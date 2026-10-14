import { describe, expect, it } from 'vitest';
import type { SlideElement } from '../../../src/core/types.ts';
import { createContext } from '../../../src/sizes.ts';
import { Box, Deck, Slide, Text } from '../index.ts';
import { layoutSlide } from '../layout/index.ts';
import { CASES, type CaseNode, type CssCase } from '../oracle/cases.ts';
import { createEnv } from '../render.ts';
import { resolveDeck } from '../resolve/index.ts';
import * as fontkit from 'fontkit';
import { DEFAULT_FONTS } from '../../../src/fonts/index.ts';
import type { LayoutEnv, PositionedNode } from '../types.ts';
import fixtures from './__fixtures__/css-cases.json' with { type: 'json' };
import { POC_DEFAULTS } from '../defaults.ts';

/**
 * H4: o motor da PoC × frames calculados por um browser real (fixtures geradas uma vez por
 * oracle/generate.ts). Sem browser aqui. textSafety 1: a folga de 3% da engine é proposital
 * (o renderizador do PPTX mede diferente) e não existe no browser.
 */

type Frame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const ORACLE = fixtures as unknown as { readonly browser: string; readonly cases: Readonly<Record<string, Readonly<Record<string, Frame>>>> };

const engineEnv = createEnv({ textSafety: 1 });

/**
 * Métrica de linha do Chromium: ascent, descent e lineGap arredondados a px inteiro antes de
 * somar (18 px de Liberation Sans → 21 px; a engine usa 20,70 pt, calibrada no Keynote). Serve
 * para separar o algoritmo de layout da métrica de fonte: com ela, as posições têm que bater.
 */
const REGULAR = fontkit.openSync(DEFAULT_FONTS[0]!.file) as fontkit.Font;
const chromeLineOf = (size: number, multiplier: number): { readonly lineHeight: number; readonly ascent: number } => {
  const unit = size / REGULAR.unitsPerEm;
  const ascent = Math.round(REGULAR.ascent * unit);
  return { lineHeight: (ascent + Math.round(-REGULAR.descent * unit) + Math.round(REGULAR.lineGap * unit)) * multiplier, ascent };
};
const browserEnv: LayoutEnv = {
  ...engineEnv,
  measureText: (input) => {
    const layout = engineEnv.measureText(input);
    const { lineHeight, ascent } = chromeLineOf(input.style.size, input.style.lineHeight);
    return { ...layout, lineHeight, ascent, height: layout.lines.length * lineHeight };
  },
};

/** Divergências documentadas com a métrica da engine (somem com a métrica do browser). */
const TEXT_METRIC_CASES: ReadonlySet<string> = new Set(['G27 texto quebra na largura da coluna']);

const elementOf = (node: CaseNode): SlideElement =>
  node.text !== undefined ? <Text {...node.style}>{node.text}</Text> : <Box {...node.style}>{(node.children ?? []).map(elementOf)}</Box>;

/** Caso e árvore posicionada têm a mesma forma: id do caso → nó posicionado. */
const pair = (node: CaseNode, positioned: PositionedNode): readonly (readonly [string, PositionedNode])[] => [
  [node.id, positioned],
  ...(node.children ?? []).flatMap((child, index) => (positioned.kind === 'box' ? pair(child, positioned.children[index]!) : [])),
];

const layoutCase = (test: CssCase, env: LayoutEnv): ReadonlyMap<string, PositionedNode> => {
  const size = { name: 'custom', width: test.width, height: test.height };
  const ctx = createContext(size);
  const [slide] = resolveDeck(<Deck><Slide>{elementOf(test.root)}</Slide></Deck>, ctx).slides;
  const positioned = layoutSlide(slide!, size, env);
  return new Map(pair(test.root, positioned.children[0]!));
};

const diffsOf = (test: CssCase, env: LayoutEnv): readonly string[] => {
  const expected = ORACLE.cases[test.name] ?? {};
  const actual = layoutCase(test, env);
  return Object.entries(expected).flatMap(([id, want]) => {
    const got = actual.get(id)?.frame;
    if (got === undefined) return [`${id}: ausente`];
    return (['x', 'y', 'width', 'height'] as const)
      .filter((key) => Math.abs(want[key] - got[key]) > POC_DEFAULTS.frameTolerance)
      .map((key) => `${id}.${key}: browser ${want[key].toFixed(2)} × PoC ${got[key].toFixed(2)}`);
  });
};

describe(`H4 — PoC × ${ORACLE.browser} (±${POC_DEFAULTS.frameTolerance} pt)`, () => {
  it('as fixtures cobrem todos os casos', () => {
    expect(Object.keys(ORACLE.cases).sort()).toEqual(CASES.map((test) => test.name).sort());
  });

  const engineCases = CASES.filter((test) => !TEXT_METRIC_CASES.has(test.name));
  it.each(engineCases.map((test) => [test.name, test] as const))('métrica da engine: %s', (_name, test) => {
    expect(diffsOf(test, engineEnv)).toEqual([]);
  });

  it.each([...TEXT_METRIC_CASES])('métrica da engine diverge só na altura do texto: %s', (name) => {
    const test = CASES.find((candidate) => candidate.name === name)!;
    expect(diffsOf(test, engineEnv).every((diff) => /\.(height|y): /.test(diff))).toBe(true);
  });

  it.each(CASES.map((test) => [test.name, test] as const))('métrica de linha do browser: %s', (_name, test) => {
    expect(diffsOf(test, browserEnv)).toEqual([]);
  });
});
