import { Chart, Deck, defineDeck } from '../index.ts';
import { tokens } from '../../../examples/tokens.ts';
import { ContentLayout } from './kit.tsx';

// examples/charts.tsx em CSS (H1): o gráfico ocupa o corpo com flex 1.
const { color } = tokens;
const quarters = ['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'];
const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];

export default defineDeck(() => (
  <Deck>
    <ContentLayout title="Receita contra a meta">
      <Chart kind="bar" title="Receita recorrente (R$ mi)" data={{ categories: quarters, series: [{ name: 'Realizado', values: [38.2, 41.5, 45.9, 52.4] }, { name: 'Meta', values: [40, 42, 45, 50] }] }} colors={[color.accent, color.muted]} legend showValues flex={1} />
    </ContentLayout>
    <ContentLayout title="Latência p95 das consultas (ms)">
      <Chart kind="line" data={{ categories: months, series: [{ name: 'Com cache', values: [420, 380, 310, 260, 240, 220] }, { name: 'Sem cache', values: [610, 640, 600, 620, 650, 630] }] }} colors={[color.accent, color.negative]} flex={1} />
    </ContentLayout>
    <ContentLayout title="Receita nova por área no Q3 (R$ mi)">
      <Chart kind="pie" data={{ categories: ['Varejo', 'Crédito', 'Seguros', 'Outros'], series: [{ name: 'Receita nova', values: [4.0, 0.6, 0.7, 1.2] }] }} showValues flex={1} />
    </ContentLayout>
  </Deck>
));
