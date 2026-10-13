import { describe, expect, it } from 'vitest';
import { Box, Slide, Text } from '../../src/primitives/index.ts';
import { byCode, fit, layoutOnly, textAt } from '../helpers/fit-env.tsx';
import { DEFAULTS } from '../../src/core/defaults.ts';

/** CONTRACTS §fit "Área zero (M6)": mensagem própria quando o Text recebeu 0 pt de altura. */

const ZERO = 'área disponível para o texto é 0 pt';
const PATH = 'Slide > Box > Text';

const zeroColumn = (fitPolicy?: 'shrink' | 'error') => (
  <Slide padding={40}>
    <Box height={0} padding={0}>
      <Text grow={1} {...(fitPolicy ? { fit: fitPolicy } : {})}>
        Texto que não tem onde ficar
      </Text>
    </Box>
  </Slide>
);

describe('fit — zero-height area', () => {
  it('precondition: the Text gets no height', () => {
    const t = textAt(layoutOnly(zeroColumn()), PATH);
    expect(t.frame.height).toBeLessThanOrEqual(DEFAULTS.fit.epsilon);
    expect(t.text.height).toBeGreaterThan(0);
  });

  it.each([undefined, 'shrink', 'error'] as const)('fit=%s: text-overflow says the area is 0 pt and does not talk about minSize', (policy) => {
    const r = fit(zeroColumn(policy));
    const errs = byCode(r, 'text-overflow').filter((d) => d.path === PATH);
    expect(errs).toHaveLength(1);
    expect(errs[0]!.severity).toBe('error');
    expect(errs[0]!.message).toContain(ZERO);
    expect(errs[0]!.message).toMatch(/grow/);
    expect(errs[0]!.message).not.toMatch(/minSize/);
  });

  it('an ordinary overflow keeps the usual message (no "0 pt" area)', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={30}>
          <Text size={24} fit="error">
            {'Texto longo que não cabe em trinta pontos de altura. '.repeat(10)}
          </Text>
        </Box>
      </Slide>,
    );
    const [d] = byCode(r, 'text-overflow');
    expect(d).toBeDefined();
    expect(d!.message).not.toContain(ZERO);
  });
});
