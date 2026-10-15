import { describe, expect, it } from 'vitest';
import { lintDeck } from '../../src/lint/lint.ts';
import { Box, Chart, Deck, Slide, Text } from '../../src/primitives/index.ts';
import type { DeckDefinition, SlideElement } from '../../src/core/types.ts';

// M16-5: as regras do `pptsx lint`.
const lint = (slide: SlideElement, extra: Partial<Parameters<typeof lintDeck>[1]> = {}) =>
  lintDeck((() => <Deck>{slide}</Deck>) as DeckDefinition, { sizes: ['16x9', '4x3'], baseDir: process.cwd(), ...extra });

describe('pptsx lint', () => {
  it('props antigas com a troca e o path; irmãos de um map agrupados', async () => {
    const findings = await lint(
      <Slide>
        <Box direction="row">{[1, 2, 3].map((n) => <Box fill="#EEEEEE"><Text size={14}>{n}</Text></Box>)}</Box>
      </Slide>,
    );
    const legacy = findings.filter((f) => f.code === 'legacy-prop');
    expect(legacy.map((f) => f.path)).toEqual(['Slide > Box', 'Slide > Box > Box[0..2]', 'Slide > Box > Box[0..2] > Text']);
    expect(legacy[0]!.message).toContain('direction="row" em <box>: troque por display="flex"');
    expect(legacy.every((f) => f.severity === 'warning' && f.size === undefined)).toBe(true);
  });

  it('deck só em CSS: nada a apontar', async () => {
    expect(await lint(<Slide padding={30} gap={10}><Text fontSize={20}>ok</Text></Slide>)).toEqual([]);
  });

  it('lineHeight ≥ 1.5, fr solto em grid e css-not-emitted', async () => {
    const findings = await lint(
      <Slide>
        <Text lineHeight={1.6}>x</Text>
        <Box display="grid" gridTemplateColumns="1fr 1fr" flex={1}><Text>a</Text><Text>b</Text></Box>
        <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" flex={1}><Text>a</Text></Box>
        <Box style={{ overflow: 'hidden' }}><Text>c</Text></Box>
      </Slide>,
    );
    expect(findings.map((f) => [f.code, f.path])).toEqual(expect.arrayContaining([
      ['keynote-line-height', 'Slide > Text'],
      ['grid-fr', 'Slide > Box[0]'],
      ['css-not-emitted', 'Slide > Box[2]'],
    ]));
    expect(findings.some((f) => f.code === 'grid-fr' && f.path === 'Slide > Box[1]')).toBe(false);
  });

  it('cores fora do tema (só com tema)', async () => {
    const slide = <Slide backgroundColor="#FFFFFF"><Text color="#2F6FED">a</Text><Text color="#123456">b</Text></Slide>;
    expect((await lint(slide)).some((f) => f.code === 'off-theme-color')).toBe(false);
    const findings = (await lint(slide, { theme: { colors: { accent1: '#2F6FED', light1: '#FFFFFF', dark1: '#000000' } } })).filter((f) => f.code === 'off-theme-color');
    // Igual nos dois tamanhos: um achado só, sem size.
    expect(findings.map((f) => [f.path, f.size])).toEqual([['Slide > Text[1]', undefined]]);
    expect(findings[0]!.message).toContain('#123456');
  });

  it('erro de estrutura vira um achado error (sem lançar)', async () => {
    const findings = await lint(<Slide><Chart kind="bar" data={{ categories: ['a'], series: [{ name: 's', values: [1] }] }} /></Slide>);
    expect(findings).toEqual([expect.objectContaining({ severity: 'error', code: 'structure', message: expect.stringContaining('<Chart> precisa de width') })]);
  });
});
