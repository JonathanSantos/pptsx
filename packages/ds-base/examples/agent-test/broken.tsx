import { Box, Deck, Text, defineDeck } from 'pptsx';
import { ContentLayout } from '@pptsx/ds-base';
import { Bullets } from '@pptsx/ds-base';
import { tokens } from '@pptsx/ds-base';

// Deck com problemas propositais para o teste do agente: corrija lendo só o
// diagnostics.json e o overview, sem mudar a intenção de cada slide.
const { color, font } = tokens;

type Kpi = { label: string; value: string; delta: string; trend: 'up' | 'down' };

const kpis: Kpi[] = [
  { label: 'Receita', value: 'R$ 52,4 mi', delta: '+14,2%', trend: 'up' },
  { label: 'Clientes ativos', value: '1,28 mi', delta: '+8,1%', trend: 'up' },
  { label: 'Disponibilidade', value: '99,95%', delta: '+0,05 p.p.', trend: 'up' },
  { label: 'Tempo de resposta', value: '182 ms', delta: '−12 ms', trend: 'up' },
  { label: 'Chamados', value: '3.412', delta: '+22%', trend: 'down' },
];

// Cartão de KPI com tamanho de valor controlável (o KpiCard pronto não expõe
// size e quebrava números no meio com 5 cards por linha).
const Indicador = ({ label, value, delta, trend, valueSize }: Kpi & { valueSize: number }) => (
  <Box flex={1} backgroundColor={color.surface} borderRadius={8} padding={16} gap={4} justifyContent="center">
    <Text fontSize={font.small} color={color.muted}>{label}</Text>
    <Text fontSize={valueSize} minSize={24} fontWeight="bold" color={color.ink}>{value}</Text>
    <Text fontSize={font.small} fontWeight="bold" color={trend === 'up' ? color.positive : color.negative}>
      {trend === 'up' ? '▲ ' : '▼ '}{delta}
    </Text>
  </Box>
);

export default defineDeck((ctx) => (
  <Deck>
    <ContentLayout title="Prioridades do próximo trimestre">
      <Bullets
        size={ctx.aspect < 1.5 ? 24 : 22}
        items={[
          'Migrar os serviços legados, inclusive relatórios regulatórios e painéis da diretoria, para a nova plataforma de dados',
          'Reduzir em 30% o custo de infraestrutura por consulta, renegociando contratos e desligando ambientes ociosos',
          'Publicar o catálogo de dados com dono, qualidade e linhagem de cada tabela crítica, revisado mensalmente',
          'Treinar as áreas de negócio no self-service dos painéis e medir a adoção semanalmente',
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Indicadores">
      <Box gap={16} flex={1}>
        {[kpis.slice(0, 3), kpis.slice(3)].map((row) => (
          <Box display="flex" gap={16} flex={1}>
            {row.map((k) => (
              <Indicador {...k} valueSize={font.h1} />
            ))}
          </Box>
        ))}
      </Box>
    </ContentLayout>

    <ContentLayout title="Linha do tempo">
      <Box display="flex" gap={12}>
        {['Planejamento', 'Migração', 'Validação', 'Desligamento'].map((phase, i) => (
          <Box flex={1} padding={12} gap={4} backgroundColor={color.surface} borderRadius={8}>
            <Text fontSize={font.small} fontWeight="bold" color={color.accent}>Fase {i + 1}</Text>
            <Text fontSize={18} fontWeight="bold" color={color.ink}>{phase}</Text>
          </Box>
        ))}
      </Box>
    </ContentLayout>
  </Deck>
));
