import { describe, expect, it } from 'vitest';
import { DEFAULTS, minSizeOf } from '../../src/core/defaults.ts';
import { Box, Slide, Text } from '../../src/primitives/index.ts';
import { atPath, byCode, fit, lineHeightAt, textAt } from '../helpers/fit-env.tsx';

/** core/defaults minSizeOf com piso (M6) e CONTRACTS §fit "Legibilidade (M6)". */

const LONG = 'Fonte: relatório trimestral consolidado, dados auditados, valores em milhões de reais. '.repeat(12);
const PATH = 'Slide > Box > Text';

const caption = (props: { size: number; minSize?: number }, height = 30, content = LONG) => (
  <Slide padding={40}>
    <Box height={height}>
      <Text {...props}>{content}</Text>
    </Box>
  </Slide>
);

describe('minSizeOf — legibility floor', () => {
  it.each([
    [11, 10],
    [12, 10],
    [13, 10],
    [14, 10],
    [16, 12],
    [24, 18],
    [44, 33],
  ])('size %d without minSize → %d', (size, expected) => {
    expect(minSizeOf({ size })).toBe(expected);
  });

  it('default size uses the same rule', () => {
    expect(minSizeOf({})).toBe(Math.max(Math.floor(DEFAULTS.text.size * DEFAULTS.text.minSizeRatio), DEFAULTS.text.minLegibleSize));
  });

  it('explicit minSize wins, even below the floor', () => {
    expect(minSizeOf({ size: 11, minSize: 8 })).toBe(8);
    expect(minSizeOf({ size: 24, minSize: 20 })).toBe(20);
  });

  it('minLegibleSize is 10', () => {
    expect(DEFAULTS.text.minLegibleSize).toBe(10);
  });
});

describe('fit — 11 pt caption without minSize stops at the floor', () => {
  it('ends at 10 pt (not 8) and does not emit text-illegible', () => {
    const r = fit(caption({ size: 11 }));
    expect(textAt(r.slide, PATH).text.fontSize).toBe(10);
    expect(byCode(r, 'text-overflow')[0]).toMatchObject({ path: PATH, data: { fromSize: 11, toSize: 10 } });
    expect(byCode(r, 'text-illegible')).toEqual([]);
  });
});

describe('fit — explicit minSize below the floor', () => {
  it('minSize 8 and nothing fits: reaches 8 and emits text-illegible warning (11 → 8)', () => {
    const r = fit(caption({ size: 11, minSize: 8 }));
    expect(textAt(r.slide, PATH).text.fontSize).toBe(8);
    const ill = byCode(r, 'text-illegible');
    expect(ill).toHaveLength(1);
    expect(ill[0]).toMatchObject({ severity: 'warning', path: PATH, size: '16x9', slide: 1, data: { fromSize: 11, toSize: 8 } });
    expect(ill[0]!.message).toContain('8 pt');
    expect(ill[0]!.message).toContain(`${DEFAULTS.text.minLegibleSize} pt`);
    expect(ill[0]!.message).toMatch(/minSize/);
  });

  it('fits at 9 pt: text-shrunk (info) and text-illegible (warning) 11 → 9', () => {
    const height = lineHeightAt(9) + 0.2;
    expect(lineHeightAt(10)).toBeGreaterThan(height + DEFAULTS.fit.epsilon);
    const r = fit(caption({ size: 11, minSize: 8 }, height, 'Fonte'));
    expect(textAt(r.slide, PATH).text.fontSize).toBe(9);
    expect(byCode(r, 'text-overflow')).toEqual([]);
    expect(byCode(r, 'text-shrunk')[0]).toMatchObject({ severity: 'info', data: { fromSize: 11, toSize: 9 } });
    expect(byCode(r, 'text-illegible')[0]).toMatchObject({ severity: 'warning', data: { fromSize: 11, toSize: 9 } });
  });

  it('reduced but still at or above the floor → no text-illegible', () => {
    const height = lineHeightAt(10) + 0.2;
    const r = fit(caption({ size: 11, minSize: 8 }, height, 'Fonte'));
    expect(textAt(r.slide, PATH).text.fontSize).toBe(10);
    expect(byCode(r, 'text-illegible')).toEqual([]);
  });
});

describe('fit — author size already below the floor', () => {
  it('size 8 that fits → no diagnostic at all', () => {
    const r = fit(
      <Slide padding={40}>
        <Text size={8}>Nota de rodapé</Text>
      </Slide>,
    );
    expect(r.diagnostics).toEqual([]);
  });

  it('size 8 that overflows → never text-illegible and the size never grows', () => {
    const r = fit(caption({ size: 8 }));
    expect(textAt(r.slide, PATH).text.fontSize).toBe(8);
    expect(byCode(r, 'text-illegible')).toEqual([]);
    expect(atPath(r, PATH).every((d) => d.code !== 'text-shrunk')).toBe(true);
  });

  it('size 8 with minSize 6 that is not reduced → no text-illegible', () => {
    const r = fit(
      <Slide padding={40}>
        <Text size={8} minSize={6}>
          Nota de rodapé
        </Text>
      </Slide>,
    );
    expect(byCode(r, 'text-illegible')).toEqual([]);
  });
});

describe('fit — text-illegible only for texts reduced by the fit', () => {
  it.each(['error', 'truncate'] as const)('fit="%s" with minSize 8 that overflows → size kept, no text-illegible', (policy) => {
    const r = fit(
      <Slide padding={40}>
        <Box height={30}>
          <Text size={11} minSize={8} fit={policy}>
            {LONG}
          </Text>
        </Box>
      </Slide>,
    );
    expect(textAt(r.slide, PATH).text.fontSize).toBe(11);
    expect(byCode(r, 'text-illegible')).toEqual([]);
  });
});
