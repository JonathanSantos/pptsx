import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/core/types.ts';
import { Box, Slide, Text } from '../../src/primitives/index.ts';
import { byCode, fit, layoutOnly, lazy, realMeasurer, textAt } from '../helpers/fit-env.tsx';
import { textStyleOf } from '../../src/core/defaults.ts';

/**
 * M8-C (fit): Text com nowrap cuja largura passa do frame é estouro de LARGURA —
 * dispara o shrink do escopo e, se persistir no mínimo, vira text-overflow com
 * data.axis 'width' e mensagem que cita nowrap. Em row, o nowrap ganha minWidth
 * (o Yoga não espreme) e passa a ser a causa dos estouros dos irmãos.
 */

const LONG = 'Uma frase bem longa que não cabe nesta caixa estreita'; // 383 pt em 15 pt
const ALMOST = 'Receita do trimestre'; // 184.5 pt em 20 pt, 175 pt em 19 pt

const widthAt = (content: string, size: number): number =>
  realMeasurer({ content, style: textStyleOf({ size }), maxWidth: Infinity }).width;

const widthOverflows = (diagnostics: readonly Diagnostic[], path: string): Diagnostic[] =>
  diagnostics.filter((d) => d.code === 'text-overflow' && d.path === path && d.data?.axis === 'width');

const heightOverflows = (diagnostics: readonly Diagnostic[], path: string): Diagnostic[] =>
  diagnostics.filter((d) => d.code === 'text-overflow' && d.path === path && d.data?.axis !== 'width');

describe('fit — nowrap width overflow with shrink', () => {
  const result = lazy(() =>
    fit(
      <Slide padding={40}>
        <Box width={180}>
          <Text nowrap size={20}>
            {LONG}
          </Text>
        </Box>
      </Slide>,
    ),
  );
  const PATH = 'Slide > Box > Text';

  it('precondition: the phrase does not fit even at the minimum (15 pt)', () => {
    expect(widthAt(LONG, 15)).toBeGreaterThan(180 + 0.5);
  });

  it('shrinks down to the minimum', () => {
    const text = textAt(result().slide, PATH);
    expect(text.text.fontSize).toBe(15);
    expect(text.text.lines).toEqual([LONG]);
  });

  it('reports text-overflow with data.axis "width" and a message citing nowrap', () => {
    const [d, ...rest] = widthOverflows(result().diagnostics, PATH);
    expect(rest).toEqual([]);
    expect(d).toBeDefined();
    expect(d!.severity).toBe('error');
    expect(d!.message).toMatch(/nowrap/);
    expect(d!.message).toMatch(/180 pt/);
    expect(d!.data?.overflowPt).toBeGreaterThan(0);
    expect(d!.data?.fromSize).toBe(20);
    expect(d!.data?.toSize).toBe(15);
  });

  it('no height overflow and no word-broken for a single nowrap line', () => {
    expect(heightOverflows(result().diagnostics, PATH)).toEqual([]);
    expect(byCode(result(), 'text-word-broken')).toEqual([]);
  });
});

describe('fit — nowrap that fits after shrinking', () => {
  const result = lazy(() =>
    fit(
      <Slide padding={40}>
        <Box width={180}>
          <Text nowrap size={20}>
            {ALMOST}
          </Text>
        </Box>
      </Slide>,
    ),
  );

  it('precondition: too wide at 20 pt, fits at 19 pt', () => {
    expect(widthAt(ALMOST, 20)).toBeGreaterThan(180 + 0.5);
    expect(widthAt(ALMOST, 19)).toBeLessThan(180);
  });

  it('shrinks just enough and reports text-shrunk, no overflow', () => {
    const text = textAt(result().slide, 'Slide > Box > Text');
    expect(text.text.fontSize).toBe(19);
    expect(text.text.width).toBeLessThanOrEqual(text.frame.width + 0.5);
    expect(byCode(result(), 'text-overflow')).toEqual([]);
    expect(byCode(result(), 'text-shrunk')).toHaveLength(1);
  });
});

describe('fit — nowrap with fit="error"', () => {
  const result = lazy(() =>
    fit(
      <Slide padding={40}>
        <Box width={180}>
          <Text nowrap fit="error" size={20}>
            {LONG}
          </Text>
        </Box>
      </Slide>,
    ),
  );

  it('does not shrink', () => {
    expect(textAt(result().slide, 'Slide > Box > Text').text.fontSize).toBe(20);
    expect(byCode(result(), 'text-shrunk')).toEqual([]);
  });

  it('reports a width text-overflow with its own message (cites nowrap, not the minimum)', () => {
    const [d] = widthOverflows(result().diagnostics, 'Slide > Box > Text');
    expect(d).toBeDefined();
    expect(d!.message).toMatch(/nowrap/);
    expect(d!.message).not.toMatch(/mínimo/);
  });
});

describe('fit — width and height overflow on the same Text', () => {
  const result = lazy(() =>
    fit(
      <Slide padding={40}>
        <Box width={180} height={30}>
          <Text nowrap size={20}>
            {`${LONG}\nsegunda linha\nterceira linha`}
          </Text>
        </Box>
      </Slide>,
    ),
  );
  const PATH = 'Slide > Box > Text';

  it('two diagnostics: one width (axis "width"), one height (no axis)', () => {
    const width = widthOverflows(result().diagnostics, PATH);
    const height = heightOverflows(result().diagnostics, PATH);
    expect(width).toHaveLength(1);
    expect(height).toHaveLength(1);
    expect(height[0]!.data?.axis).toBeUndefined();
  });
});

describe('fit — the width overflow does not receive causedBy from the height demand', () => {
  const result = lazy(() =>
    fit(
      <Slide padding={40}>
        <Box width={180} height={60}>
          <Text size={20}>{'um texto comprido que pede muita altura '.repeat(6)}</Text>
          <Text nowrap size={20}>
            {LONG}
          </Text>
        </Box>
      </Slide>,
    ),
  );

  it('the nowrap width diagnostic has no causedBy', () => {
    const [d] = widthOverflows(result().diagnostics, 'Slide > Box > Text[1]');
    expect(d).toBeDefined();
    expect(d!.data?.causedBy).toBeUndefined();
  });
});

describe('layout/fit — nowrap in a row gets minWidth', () => {
  const row = (nowrap: boolean) => (
    <Slide padding={40}>
      <Box direction="row" width={400} gap={10}>
        <Text nowrap={nowrap} size={20}>
          Rótulo comprido aqui
        </Text>
        <Text size={20}>{LONG}</Text>
      </Box>
    </Slide>
  );

  it('the Yoga does not squeeze the nowrap Text below its line width', () => {
    const text = textAt(layoutOnly(row(true)), 'Slide > Box > Text[0]');
    expect(text.text.lines).toHaveLength(1);
    expect(text.frame.width).toBeGreaterThanOrEqual(text.text.width - 0.01);
  });

  it('control: without nowrap the same Text is squeezed and wraps', () => {
    const text = textAt(layoutOnly(row(false)), 'Slide > Box > Text[0]');
    expect(text.frame.width).toBeLessThan(widthAt('Rótulo comprido aqui', 20) - 1);
  });

  it('fit: no width overflow for the nowrap Text that fits by minWidth', () => {
    const r = fit(row(true));
    expect(widthOverflows(r.diagnostics, 'Slide > Box > Text[0]')).toEqual([]);
  });
});

describe('fit — width cause in a row (M8-C "Causa por largura")', () => {
  const result = lazy(() =>
    fit(
      <Slide padding={40}>
        <Box direction="row" width={300} height={80} gap={10}>
          <Text nowrap size={20}>
            {LONG}
          </Text>
          <Text size={20}>vizinho com texto que precisa de espaço</Text>
        </Box>
      </Slide>,
    ),
  );
  const NOWRAP = 'Slide > Box > Text[0]';
  const NEIGHBOR = 'Slide > Box > Text[1]';

  it('the nowrap Text reports its width overflow', () => {
    expect(widthOverflows(result().diagnostics, NOWRAP)).toHaveLength(1);
  });

  it('the squeezed neighbor points to the nowrap as cause', () => {
    const neighbor = result().diagnostics.filter(
      (d) => d.path === NEIGHBOR && (d.code === 'text-overflow' || d.code === 'text-word-broken'),
    );
    expect(neighbor.length).toBeGreaterThan(0);
    neighbor.forEach((d) => {
      expect(d.data?.causedBy).toBe(NOWRAP);
      expect(d.message).toContain(NOWRAP);
    });
  });

  // Aqui o estouro da row já é o do próprio Text (regra M4: Text reportado não gera box-overflow
  // no pai); quando houver box-overflow da row, ele aponta o nowrap.
  it('a row box-overflow, if any, points to the nowrap as cause', () => {
    byCode(result(), 'box-overflow')
      .filter((d) => d.path === 'Slide > Box')
      .forEach((d) => expect(d.data?.causedBy).toBe(NOWRAP));
  });
});
