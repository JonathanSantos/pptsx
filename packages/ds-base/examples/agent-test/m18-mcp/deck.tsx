import { B, Box, Deck, Text, defineDeck } from 'pptsx';
import {
  Bullets,
  ClosingLayout,
  ContentLayout,
  CoverLayout,
  KpiRow,
  TwoColumn,
  tokens,
} from '@pptsx/ds-base';

const { color, font, space } = tokens;

const quarters = [
  { q: 'T1', title: 'Fundação', text: 'Nova plataforma de dados' },
  { q: 'T2', title: 'Lançamento', text: 'App móvel 2.0 em produção' },
  { q: 'T3', title: 'Expansão', text: 'Dois mercados na América Latina' },
  { q: 'T4', title: 'Escala', text: 'Plano enterprise e parcerias' },
];

export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout ctx={ctx} caption="Produto · 2027" title="Plano de produto 2027" subtitle="Prioridades, metas e roadmap" />

    <ContentLayout title="Prioridades do ano" notes="Abra pelas três apostas e feche com o foco em retenção.">
      <Bullets
        gap={{ base: 14, tall: 24 }}
        items={[
          ['Retenção primeiro: ', <B>churn abaixo de 2%</B>],
          'Experiência móvel unificada em todas as plataformas',
          'Plataforma de dados como base para personalização',
          'Expansão para dois novos mercados',
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Metas 2027" justify="center">
      <KpiRow
        items={[
          { label: 'Receita recorrente (R$ mi)', value: '84', delta: '+32%', trend: 'up' },
          { label: 'Clientes ativos (mil)', value: '120', delta: '+45%', trend: 'up' },
          { label: 'Churn mensal', value: '1,8%', delta: '−0,6 pp', trend: 'down', sentiment: 'positive' },
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Roadmap por trimestre">
      <TwoColumn
        ratio={0.4}
        stacked={{ base: false, tall: true }}
        left={
          <Bullets
            size={18}
            items={['Entregas trimestrais com revisão de metas', 'Cada trimestre libera uma frente', 'Dependências tratadas no T1']}
          />
        }
        right={
          <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={space.gap} flex={1}>
            {quarters.map((item) => (
              <Box backgroundColor={color.surface} borderRadius={8} padding={12} gap={4} color={color.ink}>
                <Text fontSize={font.caption} fontWeight="bold" color={color.accent}>{item.q}</Text>
                <Text fontSize={18} fontWeight="bold">{item.title}</Text>
                <Text fontSize={font.caption} color={color.muted}>{item.text}</Text>
              </Box>
            ))}
          </Box>
        }
      />
    </ContentLayout>

    <ClosingLayout ctx={ctx} title="Obrigado" subtitle="Plano de produto 2027" contact="produto@empresa.com" />
  </Deck>
));
