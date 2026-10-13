import { Box, Deck, Image, Text, defineDeck } from 'tsx-slides';
import { tokens } from './tokens.ts';
import { ClosingLayout, ContentLayout, CoverLayout } from './layouts/index.ts';
import { Bullets, KpiRow, TwoColumn } from './components/index.ts';

const { color, font, space } = tokens;

// Mesmo código para 16x9, 4x3 e wide: o flexbox redistribui o espaço e ctx só
// entra onde a estrutura muda (colunas empilhadas em telas mais "quadradas").
export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout title="Resultados Q3 2026" subtitle="Plataforma interna de dados · revisão trimestral" />

    <ContentLayout title="Destaques do trimestre">
      <Bullets
        size={font.h2 - 2}
        items={[
          'Receita recorrente cresceu 14% sobre o Q2.',
          'Migração dos pipelines legados concluída antes do prazo.',
          'Custo por consulta caiu 22% com o novo cache de leitura.',
          'Três novas áreas de negócio passaram a usar o catálogo.',
          'Disponibilidade de 99,95%, acima da meta de 99,9%.',
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Receita recorrente em alta">
      <TwoColumn
        stacked={ctx.aspect < 1.5}
        ratio={0.4}
        left={
          <Bullets
            size={font.body - 2}
            items={[
              'Quarto trimestre seguido de crescimento.',
              'Varejo responde por 61% da receita nova.',
              'Churn de clientes caiu para 1,8%.',
            ]}
          />
        }
        right={<Image src="./assets/revenue-chart.png" fit="contain" grow={1} />}
      />
    </ContentLayout>

    <ContentLayout title="Indicadores-chave">
      <Box grow={1} justify="center" gap={space.gap * 1.5}>
        <KpiRow
          items={[
            { label: 'Receita (R$ mi)', value: '52,4', delta: '+14,2% vs Q2', trend: 'up' },
            { label: 'Disponibilidade', value: '99,95%', delta: '+0,05 p.p.', trend: 'up' },
            { label: 'NPS interno', value: '62', delta: '−4 pts vs Q2', trend: 'down' },
          ]}
        />
        <Box fill={color.accentSoft} radius={8} padding={{ top: 14, bottom: 14, left: space.gap, right: space.gap }}>
          <Text size={font.small + 2} color={color.ink}>
            O NPS interno caiu durante a migração dos pipelines; um time de suporte dedicado às áreas usuárias começa em novembro.
          </Text>
        </Box>
      </Box>
    </ContentLayout>

    <ClosingLayout
      title="Obrigado"
      subtitle="Próximo passo: abrir o catálogo de dados para as áreas de crédito e logística no Q4."
      contact="dados-plataforma@empresa.com.br"
    />
  </Deck>
));
