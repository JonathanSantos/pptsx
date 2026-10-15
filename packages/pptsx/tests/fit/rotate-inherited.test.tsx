import { describe, expect, it } from 'vitest';
import { Box, Chart, Slide, Table, Text } from '../../src/index.ts';
import { cssFit, deckOf } from '../helpers/css-fit.tsx';
import type { SlideElement } from '../../src/core/types.ts';

// M16-1 (M11-D): gráfico/tabela dentro de caixa girada saem retos; o aviso cita o ancestral.
const warningsOf = (slide: SlideElement) => cssFit(deckOf(slide)).diagnostics.filter((d) => d.code === 'css-not-emitted');
const DATA = { categories: ['a'], series: [{ name: 's', values: [1] }] };

describe('rotate herdado em Chart/Table', () => {
  it('avisa no Chart e na Table com o path do ancestral girado', () => {
    const warnings = warningsOf(
      <Slide>
        <Box rotate={10} width={300} height={200}>
          <Box flex={1}>
            <Chart kind="bar" flex={1} data={DATA} />
            <Table columns={[{ header: 'A' }]} rows={[['1']]} />
          </Box>
        </Box>
      </Slide>,
    );
    expect(warnings.map((w) => w.path)).toEqual(['Slide > Box > Box > Chart', 'Slide > Box > Box > Table']);
    expect(warnings[0]!.message).toContain('rotate: 10 (herdado de Slide > Box)');
  });

  it('o rotate próprio continua avisando uma vez; Text dentro de caixa girada não avisa', () => {
    const warnings = warningsOf(
      <Slide>
        <Box rotate={5} width={300} height={200}>
          <Chart kind="bar" rotate={3} flex={1} data={DATA} />
          <Text>gira junto</Text>
        </Box>
      </Slide>,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('rotate: 3 não sai');
  });
});

describe('M17: largura de borda sem estilo', () => {
  it('avisa com a troca sugerida; borda com estilo não avisa', () => {
    const warnings = warningsOf(
      <Slide>
        <Box borderLeftWidth={6} borderLeftColor="#FF0000" padding={8}><Text>a</Text></Box>
        <Box borderLeft="6px solid #FF0000" padding={8}><Text>b</Text></Box>
      </Slide>,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ path: 'Slide > Box[0]' });
    expect(warnings[0]!.message).toContain('borderLeftWidth: 6 não sai no PPTX: sem borderLeftStyle a borda não aparece');
  });
});
