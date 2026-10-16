import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/core/types.ts';
import { Box, Slide, Text } from '../../src/primitives/index.ts';
import { attributeComponents, componentSourcesOf } from '../../src/fit/component.ts';
import { fit, layoutOnly } from '../helpers/fit-env.tsx';

/**
 * 1.0.5 (CONTRACTS §fit "Componente"): diagnóstico de um nó dentro de uma instância de componente leva
 * `data.component` = `<Nome prop=valor … />` da instância mais próxima; fora de componentes, nada.
 */

const LONG = 'Um parágrafo bem longo que repete bastante texto para forçar o estouro vertical. '.repeat(12);

const Card = (props: { readonly title: string; readonly body: string }) => (
  <Box flex={1} padding={10} backgroundColor="#EEEEEE">
    <Text fontSize={20} fit="error">{props.title}</Text>
    <Text fontSize={16} fit="error">{props.body}</Text>
  </Box>
);

const probe = () => (
  <Slide padding={40} gap={10}>
    <Text fontSize={16} fit="error">{LONG}</Text>
    <Box display="flex" gap={10} height={120}>
      <Card title="Um" body={LONG} />
      <Card title="Dois" body={LONG} />
    </Box>
  </Slide>
);

// 40 caracteres da string e reticências, como o pptsx-rs.
const CARD_ONE = '<Card title="Um" body="Um parágrafo bem longo que repete bastan…" />';

describe('componentSourcesOf', () => {
  it('mapeia cada nó dentro de uma instância para o source dela (raiz e descendentes); fora, nada', () => {
    const sources = componentSourcesOf(layoutOnly(probe()));
    expect(sources.get('Slide > Box > Card[0]')).toBe(CARD_ONE);
    expect(sources.get('Slide > Box > Card[0] > Text[1]')).toBe(CARD_ONE);
    expect(sources.get('Slide > Box > Card[1] > Text[1]')).toContain('title="Dois"');
    expect(sources.has('Slide > Text')).toBe(false);
    expect(sources.has('Slide > Box')).toBe(false);
  });
});

describe('fitSlide — data.component', () => {
  it('estouros dentro do Card levam o componente; o parágrafo solto não', () => {
    const r = fit(probe());
    const inside = r.diagnostics.filter((d) => d.path.startsWith('Slide > Box > Card'));
    expect(inside.length).toBeGreaterThan(0);
    for (const d of inside) expect(d.data?.component, d.path).toMatch(/^<Card title="(Um|Dois)" body="Um parágrafo/);
    const loose = r.diagnostics.filter((d) => d.path === 'Slide > Text');
    expect(loose.length).toBeGreaterThan(0);
    for (const d of loose) expect(d.data?.component).toBeUndefined();
  });

  it('o agrupamento (Card[0..1]) preserva o componente do pior membro', () => {
    const r = fit(probe());
    const grouped = r.diagnostics.find((d) => d.path === 'Slide > Box > Card[0..1] > Text[1]');
    if (grouped === undefined) return; // os dois cards podem não agrupar se os estouros diferem
    expect(grouped.data?.count).toBe(2);
    expect(grouped.data?.component).toMatch(/^<Card /);
  });
});

describe('attributeComponents (pura)', () => {
  it('não sobrescreve um data.component existente e deixa diagnósticos sem nó no mapa como estão', () => {
    const slide = layoutOnly(probe());
    const own: Diagnostic = { severity: 'error', code: 'text-overflow', size: '16x9', slide: 1, path: 'Slide > Box > Card[0] > Text[1]', message: 'm', data: { component: '<Outro />' } };
    const orphan: Diagnostic = { severity: 'warning', code: 'font-missing', size: '16x9', slide: 1, path: 'Slide > Nada', message: 'm' };
    const [a, b] = attributeComponents([own, orphan], slide);
    expect(a!.data?.component).toBe('<Outro />');
    expect(b).toBe(orphan);
  });
});
