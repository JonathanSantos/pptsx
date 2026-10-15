// M11: cópia congelada de examples/charts.tsx do commit 7bf9fc7 (props antigas como alias do CSS), para a paridade
// com o motor pré-M11 (tests/examples/engine-parity, tests/emit/emit-parity). Assets via baseDir = examples/.
import { Chart, Deck, defineDeck } from 'pptsx';
import { tokens } from './tokens.ts';
import { ContentLayout } from './layouts/index.ts';

const { color } = tokens;

// Os três tipos de gráfico nativo, cada um ocupando o corpo do slide com grow: o mesmo
// código serve a 16x9 e 4x3 (o gráfico não tem tamanho próprio, fica com o que o flex der).
// Valores numéricos com ponto; o PowerPoint/Keynote formata com a vírgula do idioma.
const quarters = ['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'];
const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];

export default defineDeck(() => (
  <Deck>
    <ContentLayout title="Receita contra a meta">
      <Chart
        kind="bar"
        title="Receita recorrente (R$ mi)"
        data={{
          categories: quarters,
          series: [
            { name: 'Realizado', values: [38.2, 41.5, 45.9, 52.4] },
            { name: 'Meta', values: [40, 42, 45, 50] },
          ],
        }}
        colors={[color.accent, color.muted]}
        legend
        labels
        flex={1}
      />
    </ContentLayout>

    <ContentLayout title="Latência p95 das consultas (ms)">
      <Chart
        kind="line"
        data={{
          categories: months,
          series: [
            { name: 'Com cache', values: [420, 380, 310, 260, 240, 220] },
            { name: 'Sem cache', values: [610, 640, 600, 620, 650, 630] },
          ],
        }}
        colors={[color.accent, color.negative]}
        flex={1}
      />
    </ContentLayout>

    <ContentLayout title="Receita nova por área no Q3 (R$ mi)">
      {/* Sem colors: a paleta padrão dá uma cor por fatia. */}
      <Chart
        kind="pie"
        data={{
          categories: ['Varejo', 'Crédito', 'Seguros', 'Outros'],
          series: [{ name: 'Receita nova', values: [4.0, 0.6, 0.7, 1.2] }],
        }}
        labels
        flex={1}
      />
    </ContentLayout>
  </Deck>
));
