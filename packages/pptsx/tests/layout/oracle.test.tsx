import { describe, expect, it } from 'vitest';
import * as fontkit from 'fontkit';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { LayoutEnv, PositionedNode, SlideElement } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { layoutSlide } from '../../src/layout/index.ts';
import { Box, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext } from '../../src/sizes.ts';
import { cssEnv } from '../helpers/css-fit.tsx';
import { CASES, type CaseNode, type CssCase } from './__fixtures__/css-cases.ts';
import fixtures from './__fixtures__/css-cases.json' with { type: 'json' };

/**
 * M11 (H4, de poc/css/tests/h4-oracle.test.tsx): o motor × frames calculados por um browser
 * real (fixtures geradas uma vez por tools/oracle/generate.ts). Sem browser aqui. textSafety 1:
 * a folga de 3% da engine é proposital (o renderizador do PPTX mede diferente) e não existe no
 * browser.
 */

type Frame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const ORACLE = fixtures as unknown as { readonly browser: string; readonly cases: Readonly<Record<string, Readonly<Record<string, Frame>>>> };
const TOLERANCE = DEFAULTS.css.frameTolerance;

const engineEnv = cssEnv(undefined, 1);

/**
 * Métrica de linha do Chromium: ascent, descent e lineGap arredondados a px inteiro antes de
 * somar (18 px de Liberation Sans → 21 px; a engine usa 20,70 pt, calibrada no Keynote). Serve
 * para separar o algoritmo de layout da métrica de fonte: com ela, as posições têm que bater.
 * `lineHeight` numérico (CSS) é n × size, com a meia-entrelinha acima da linha.
 */
const REGULAR = fontkit.openSync(DEFAULT_FONTS[0]!.file) as fontkit.Font;
const chromeLineOf = (size: number, lineHeight: number | 'normal'): { readonly lineHeight: number; readonly ascent: number } => {
  const unit = size / REGULAR.unitsPerEm;
  const ascent = Math.round(REGULAR.ascent * unit);
  const natural = ascent + Math.round(-REGULAR.descent * unit) + Math.round(REGULAR.lineGap * unit);
  if (lineHeight === 'normal') return { lineHeight: natural, ascent };
  const line = lineHeight * size;
  return { lineHeight: line, ascent: ascent + (line - natural) / 2 };
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
    if (got === undefined) return [`${id}: missing`];
    return (['x', 'y', 'width', 'height'] as const)
      .filter((key) => Math.abs(want[key] - got[key]) > TOLERANCE)
      .map((key) => `${id}.${key}: browser ${want[key].toFixed(2)} × engine ${got[key].toFixed(2)}`);
  });
};

describe(`layout × ${ORACLE.browser} (±${TOLERANCE} pt)`, () => {
  it('fixtures cover every case', () => {
    expect(Object.keys(ORACLE.cases).sort()).toEqual(CASES.map((test) => test.name).sort());
  });

  const engineCases = CASES.filter((test) => !TEXT_METRIC_CASES.has(test.name));
  it.each(engineCases.map((test) => [test.name, test] as const))('engine metric: %s', (_name, test) => {
    expect(diffsOf(test, engineEnv)).toEqual([]);
  });

  it.each([...TEXT_METRIC_CASES])('engine metric differs only in text height: %s', (name) => {
    const test = CASES.find((candidate) => candidate.name === name)!;
    expect(diffsOf(test, engineEnv).every((diff) => /\.(height|y): /.test(diff))).toBe(true);
  });

  it.each(CASES.map((test) => [test.name, test] as const))('browser line metric: %s', (_name, test) => {
    expect(diffsOf(test, browserEnv)).toEqual([]);
  });
});
