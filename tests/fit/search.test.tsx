import { describe, expect, it } from 'vitest';
import { detectOverflow } from '../../src/fit/index.ts';
import { DEFAULTS, textStyleOf } from '../../src/core/defaults.ts';
import type { TextMeasureInput } from '../../src/core/types.ts';
import { Box, Slide, Text } from '../../src/primitives/index.ts';
import {
  byCode,
  createSpyEnv,
  fit,
  fitWith,
  layoutOnly,
  lazy,
  lineHeightAt,
  realMeasurer,
  textAt,
} from '../helpers/fit-env.tsx';

/** CONTRACTS §fit "Loop (M6 — busca binária)". */

/** Quantos layouts tocaram o conteúdo: cada tentativa da busca mede o Text num size novo. */
const distinctSizesOf = (calls: readonly TextMeasureInput[], content: string): number[] =>
  [...new Set(calls.filter((c) => c.content === content).map((c) => c.style.size))].sort((a, b) => b - a);

/** Bisseção em inteiros sobre `n` valores de delta: ⌈log₂ n⌉ tentativas + o layout inicial. */
const layoutBudget = (deltaCount: number): number => Math.ceil(Math.log2(deltaCount)) + 1;

const TITLE = 'Um título bem comprido que certamente vai quebrar em duas linhas mesmo no tamanho mínimo de vinte pontos';

describe('binary search — 44 pt title with minSize 20 in a 30 pt box', () => {
  const slide = () => (
    <Slide padding={40}>
      <Box height={30}>
        <Text size={44} minSize={20}>
          {TITLE}
        </Text>
      </Box>
    </Slide>
  );
  const run = lazy(() => {
    const { env, calls } = createSpyEnv();
    return { r: fitWith(env, slide()), calls };
  });

  it('precondition: it does not fit even at 20 pt', () => {
    const t = textAt(layoutOnly(slide()), 'Slide > Box > Text');
    const atMin = realMeasurer({ content: TITLE, style: textStyleOf({ size: 20 }), maxWidth: t.frame.width });
    expect(atMin.height).toBeGreaterThan(30 + DEFAULTS.fit.epsilon);
  });

  it('ends at toSize 20 (the minimum) with a text-overflow error', () => {
    const { r } = run();
    expect(textAt(r.slide, 'Slide > Box > Text').text.fontSize).toBe(20);
    const errs = byCode(r, 'text-overflow');
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ severity: 'error', path: 'Slide > Box > Text', data: { fromSize: 44, toSize: 20 } });
    expect(errs[0]!.message).not.toMatch(/parou após/);
  });

  it(`uses at most ${layoutBudget(24)} layouts for the scope (bisection over 24 deltas)`, () => {
    const { calls } = run();
    const sizes = distinctSizesOf(calls, TITLE);
    expect(sizes).toContain(44);
    expect(sizes).toContain(20);
    expect(sizes.length, `sizes tried: ${sizes.join(', ')}`).toBeLessThanOrEqual(layoutBudget(24));
  });
});

describe('binary search — fits at an intermediate size', () => {
  const height = () => lineHeightAt(31) + 0.2;
  const slide = () => (
    <Slide padding={40}>
      <Box height={height()}>
        <Text size={44} minSize={20}>
          Título
        </Text>
      </Box>
    </Slide>
  );
  const run = lazy(() => {
    const { env, calls } = createSpyEnv();
    return { r: fitWith(env, slide()), calls };
  });

  it('precondition: 31 fits, 32 does not', () => {
    expect(lineHeightAt(31)).toBeLessThanOrEqual(height() + DEFAULTS.fit.epsilon);
    expect(lineHeightAt(32)).toBeGreaterThan(height() + DEFAULTS.fit.epsilon);
  });

  it('ends at the largest size that fits (31) with text-shrunk', () => {
    const { r } = run();
    expect(textAt(r.slide, 'Slide > Box > Text').text.fontSize).toBe(31);
    expect(byCode(r, 'text-overflow')).toEqual([]);
    expect(byCode(r, 'text-shrunk')[0]).toMatchObject({ severity: 'info', data: { fromSize: 44, toSize: 31 } });
  });

  // Aqui o contrato não fixa a ordem das tentativas (testar maxDelta antes é válido):
  // o limite só separa bisseção (≤ 7) de descida linear (14 sizes de 44 a 31).
  it(`uses at most ${layoutBudget(25) + 1} layouts (bisection, not 1 pt steps)`, () => {
    const sizes = distinctSizesOf(run().calls, 'Título');
    expect(sizes.length, `sizes tried: ${sizes.join(', ')}`).toBeLessThanOrEqual(layoutBudget(25) + 1);
  });
});

describe('binary search — a scope moves down together by the same delta', () => {
  const Card = ({ title, body }: { title: number; body: number }) => (
    <Box height={120}>
      <Text size={title} fit="shrink">
        Resultado do trimestre
      </Text>
      <Text size={body} fit="shrink">
        {'Receita cresceu acima da meta em todas as regiões, com margem estável e custo controlado. '.repeat(3)}
      </Text>
    </Box>
  );
  const slide = (title = 30, body = 20) => (
    <Slide padding={40}>
      <Card title={title} body={body} />
    </Slide>
  );
  const result = lazy(() => fit(slide()));

  it('precondition: the card overflows at the authored sizes', () => {
    expect(detectOverflow(layoutOnly(slide())).length).toBeGreaterThan(0);
  });

  it('both texts lose the same number of points (or stop at their own minimum)', () => {
    const r = result();
    const title = textAt(r.slide, 'Slide > Card > Text[0]').text.fontSize;
    const body = textAt(r.slide, 'Slide > Card > Text[1]').text.fontSize;
    const d = 30 - title;
    expect(d).toBeGreaterThan(0);
    expect(body).toBe(Math.max(15, 20 - d)); // minSizeOf({ size: 20 }) = 15
    expect(title).toBe(Math.max(22, 30 - d)); // minSizeOf({ size: 30 }) = 22
  });

  it('the delta is the smallest one without overflow: one point less still overflows', () => {
    const r = result();
    const d = 30 - textAt(r.slide, 'Slide > Card > Text[0]').text.fontSize;
    expect(detectOverflow(r.slide)).toEqual([]);
    const previous = d - 1;
    expect(detectOverflow(layoutOnly(slide(30 - previous, Math.max(15, 20 - previous)))).length).toBeGreaterThan(0);
  });
});

describe('binary search — a wide word goes straight to the size where it fits', () => {
  const WORD = 'infiltrabilidadeilimitadailicitamenteili';
  const COLUMN = 150;
  const oneWord = (props: { minSize?: number }) => (
    <Slide>
      <Box width={COLUMN}>
        <Text size={24} {...props}>
          {WORD}
        </Text>
      </Box>
    </Slide>
  );

  /** O maior size inteiro em [min, 24] em que a palavra não parte na largura real do frame; undefined se nenhum. */
  const largestFitting = (min: number): number | undefined => {
    const width = textAt(layoutOnly(oneWord({})), 'Slide > Box > Text').frame.width;
    const sizes = Array.from({ length: 24 - min + 1 }, (_, i) => 24 - i);
    return sizes.find((size) => !realMeasurer({ content: WORD, style: textStyleOf({ size }), maxWidth: width }).wordBroken);
  };

  it('sanity: the word has 40 characters and breaks at 24 pt in 150 pt', () => {
    expect(WORD).toHaveLength(40);
    const t = textAt(layoutOnly(oneWord({})), 'Slide > Box > Text');
    expect(t.text.wordBroken).toBe(true);
  });

  it('the fitting size is where widestSegment ≤ frame.width × textSafety', () => {
    const expected = largestFitting(6)!;
    expect(expected).toBeDefined();
    const widestAt = (size: number) =>
      realMeasurer({ content: WORD, style: textStyleOf({ size }), maxWidth: Infinity }).widestSegment;
    expect(widestAt(expected)).toBeLessThanOrEqual(COLUMN * DEFAULTS.textSafety + 1e-6);
    expect(widestAt(expected + 1)).toBeGreaterThan(COLUMN * DEFAULTS.textSafety);
  });

  it('explicit low minSize: ends unbroken at the largest integer size that fits', () => {
    const expected = largestFitting(6)!;
    const r = fit(oneWord({ minSize: 6 }));
    const t = textAt(r.slide, 'Slide > Box > Text');
    expect(t.text.wordBroken).toBe(false);
    expect(t.text.fontSize).toBe(expected);
    expect(byCode(r, 'text-word-broken')).toEqual([]);
    expect(byCode(r, 'text-shrunk')[0]).toMatchObject({ data: { fromSize: 24, toSize: expected } });
  });

  it('default minSize (18): not even the minimum fits → stops at 18 with text-word-broken', () => {
    expect(largestFitting(18)).toBeUndefined();
    const r = fit(oneWord({}));
    const t = textAt(r.slide, 'Slide > Box > Text');
    expect(t.text.fontSize).toBe(18);
    expect(t.text.wordBroken).toBe(true);
    expect(byCode(r, 'text-word-broken')[0]).toMatchObject({ severity: 'warning', data: { fromSize: 24, toSize: 18 } });
  });
});
