import { B, Box, Deck, Image, Text, defineDeck } from 'pptsx';
import { tokens } from '../tokens.ts';
import { ContentLayout, CoverLayout } from '../layouts/index.ts';
import { Bullets, KpiRow, TwoColumn } from '../components/index.ts';

const { color, font, space } = tokens;

// Reunião fictícia de resultados do produto "Atlas" (Q3 2026).
const kpis = [
  { label: 'Receita (R$ mi)', value: '18,6', delta: '+21%', trend: 'up' as const },
  { label: 'Clientes ativos', value: '4.310', delta: '+9%', trend: 'up' as const },
  { label: 'Churn mensal', value: '1,8%', delta: '−0,3 pp', trend: 'down' as const, sentiment: 'positive' as const },
  { label: 'NPS', value: '58', delta: '−2', trend: 'down' as const },
];

const actions = [
  'Migrar os 40 maiores clientes para o plano Enterprise até novembro',
  'Reduzir o tempo de onboarding de 14 para 7 dias com o assistente guiado',
  'Lançar a integração com ERPs nacionais (Totvs e Omie)',
  'Revisar a política de descontos do canal de parceiros',
  'Contratar 6 pessoas para o time de sucesso do cliente',
  'Publicar a API pública v2 com limites por plano',
  'Automatizar a cobrança de inadimplentes em até 3 dias',
  'Abrir o escritório comercial em Recife',
  'Reduzir em 20% os chamados de primeiro nível com a base de ajuda',
  'Testar preço anual com desconto de 15% em dois segmentos',
  'Consolidar os painéis de uso em um único relatório mensal',
  'Planejar o orçamento de 2027 com cenário conservador e agressivo',
];

const Highlights = () => (
  <Bullets
    size={{ base: font.small + 3, tall: font.body, wide: font.body + 2 }}
    gap={{ base: space.tight, tall: space.gap * 0.8, wide: space.gap * 0.8 }}
    items={[
      <>Receita <B>+21%</B> no trimestre, acima da meta de 15%</>,
      'Plano Enterprise já é 38% da receita recorrente',
      'Sudeste concentra 55% dos novos contratos',
      'NPS caiu 2 pontos após a mudança de preço',
    ]}
  />
);

export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout
      ctx={ctx}
      caption="Produto Atlas · reunião de resultados"
      title="Resultados do 3º trimestre"
      subtitle={ctx.pick({ base: 'Crescimento, retenção e próximos passos', wide: 'Crescimento, retenção e próximos passos para o Q4 2026' })}
    />

    <ContentLayout title="Indicadores do trimestre" justify="center">
      <Box gap={{ base: space.gap, tall: space.gap * 2, wide: space.gap * 1.5 }}>
        <KpiRow
          size={{ base: 'md', tall: 'lg', wide: 'lg' }}
          items={kpis.slice(0, ctx.pick({ base: 3, wide: 4 }))}
        />
        <Text size={{ base: font.body, wide: font.h2 }} color={color.muted}>
          Melhor trimestre do ano: receita e base cresceram juntas, com churn em queda.
        </Text>
      </Box>
    </ContentLayout>

    <ContentLayout title="Receita por região">
      <TwoColumn
        direction={{ base: 'row', tall: 'column' }}
        ratio={0.5}
        left={<Highlights />}
        right={<Image src="../assets/chart.png" width="100%" maxHeight="100%" alignSelf="start" />}
      />
    </ContentLayout>

    <ContentLayout title={ctx.pick({ base: 'Plano de ação para o Q4', wide: 'Plano de ação para o Q4: doze frentes' })}>
      <Bullets
        paginate
        size={{ base: font.body, tall: font.body + 2, wide: font.h2 + 2 }}
        gap={{ base: space.tight * 1.4, tall: space.gap * 1.1, wide: space.gap * 1.1 }}
        items={actions}
      />
    </ContentLayout>
  </Deck>
));
