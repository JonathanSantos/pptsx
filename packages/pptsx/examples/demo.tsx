import { B, Chart, Deck, Table, Text, defineDeck } from 'pptsx';
import { tokens } from './tokens.ts';
import { ClosingLayout, ContentLayout, CoverLayout } from './layouts/index.ts';
import { Bullets, KpiRow, TwoColumn } from './components/index.ts';

const { color, font, space } = tokens;

// Valores com ponto (número no gráfico); o PowerPoint exibe com a vírgula do idioma.
const revenue = {
  categories: ['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'],
  series: [{ name: 'Receita (R$\u00A0mi)', values: [38.2, 41.5, 45.9, 52.4] }],
};

// Na tabela as células são texto: a vírgula decimal e o sinal vão como o autor escreveu.
const revenueByArea = [
  ['Varejo', '18,6', '22,6', '+21,5%'],
  ['Crédito', '9,8', '10,4', '+6,1%'],
  ['Seguros', '6,1', '6,8', '+11,5%'],
  ['Logística', '4,7', '5,0', '+6,4%'],
  ['Marketing', '3,9', '4,2', '+7,7%'],
  ['Corporativo', '2,8', '3,4', '+21,4%'],
];

// Mesmo código para 16x9, 4x3 e wide: flex e grid redistribuem o espaço e os valores
// responsivos só mudam onde a estrutura muda (colunas empilhadas em telas mais
// "quadradas", `tall`) ou onde sobra área para tipografia maior (`wide`).
// `tall` (4:3) tem a largura do 16:9 mas é mais alto: a altura extra vai para
// espaçamento e cartões maiores. `wide` é maior nos dois eixos: o texto cresce.
export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout
      ctx={ctx}
      caption="Revisão trimestral · outubro de 2026"
      title="Resultados Q3 2026"
      subtitle="Plataforma interna de dados"
    />

    <ContentLayout title="Destaques do trimestre" justify="center">
      <Bullets
        size={{ base: font.h2, tall: font.h2 + 4, wide: font.h2 + 6 }}
        gap={{ base: space.gap * 0.8, tall: space.gap * 1.25, wide: space.gap * 1.25 }}
        items={[
          'Receita recorrente cresceu 14% sobre o Q2.',
          'Pipelines legados migrados antes do prazo.',
          'Custo por consulta caiu 22% com novo cache.',
          'Três novas áreas passaram a usar o catálogo.',
          'Disponibilidade de 99,95% (meta: 99,9%).',
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Receita recorrente em alta">
      <TwoColumn
        stacked={{ base: false, tall: true }}
        ratio={0.45}
        left={
          <Bullets
            size={{ base: font.body - 2, wide: font.body + 2 }}
            items={[
              'Quarto trimestre seguido de crescimento.',
              'Varejo responde por 61% da receita nova.',
              'Churn de clientes caiu para 1,8%.',
            ]}
          />
        }
        // Gráfico nativo (editável no PowerPoint): sem tamanho próprio, estica na célula do
        // grid; lado a lado fica com a altura do corpo, empilhado com a sobra.
        right={
          <Chart
            kind="bar"
            data={revenue}
            colors={[color.accent]}
            showValues
          />
        }
      />
    </ContentLayout>

    <ContentLayout title="Indicadores-chave">
      <KpiRow
        size={{ base: 'md', tall: 'lg', wide: 'lg' }}
        items={[
          // NBSP entre "R$" e "mi": a unidade nunca fica sozinha no começo de uma linha.
          { label: 'Receita (R$\u00A0mi)', value: '52,4', delta: '+14,2% vs Q2', trend: 'up' },
          { label: 'Custo por consulta', value: '−22%', delta: 'menor do ano', trend: 'down', sentiment: 'positive' },
          { label: 'NPS interno', value: '62', delta: '−4 pts vs Q2', trend: 'down' },
        ]}
      />
      {/* Nota com barra: borderLeft + paddingLeft no próprio Text (antes: Box row + Shape). */}
      <Text
        fontSize={{ base: font.small + 2, tall: font.body - 2, wide: font.body - 2 }}
        maxWidth="80%"
        marginTop={space.gap * 1.5}
        borderLeft={`4px solid ${color.accent}`}
        paddingLeft={space.tight + 4}
      >
        O NPS caiu na migração dos pipelines; um time de suporte dedicado às áreas usuárias começa
        em <B>novembro</B>.
      </Text>
    </ContentLayout>

    <ContentLayout title="Receita por área">
      <Table
        columns={[
          { header: 'Área', width: '40%' },
          { header: 'Q2 (R$\u00A0mi)', align: 'right' },
          { header: 'Q3 (R$\u00A0mi)', align: 'right' },
          { header: 'Δ', align: 'right' },
        ]}
        rows={revenueByArea}
        fontSize={{ base: font.small, tall: font.small + 2, wide: font.small + 2 }}
        header={{ fill: color.brand, color: color.white }}
        stripe={color.surface}
        border={color.muted}
      />
    </ContentLayout>

    <ClosingLayout
      ctx={ctx}
      title="Obrigado"
      subtitle="Próximo passo: abrir o catálogo de dados para as áreas de crédito e logística no Q4."
      contact="dados-plataforma@empresa.com.br"
    />
  </Deck>
));
