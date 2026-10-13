import { Box, Deck, Text, defineDeck } from 'tsx-slides';
import { ContentLayout } from '../layouts/index.ts';
import { Bullets, KpiRow } from '../components/index.ts';
import { tokens } from '../tokens.ts';

// Deck original do teste de agente (reconstruído do LOG.md); M6-H mede quantos
// builds um agente leva para corrigi-lo. Problemas propositais: bullets longos
// demais em 28 pt (slide 1), 5 KPIs com valores longos que estouram e partem
// palavras (slide 2), 4 fases com largura fixa que somam mais que o corpo (slide 3).
// Corrija lendo só o diagnostics.json e o overview, sem mudar a intenção de cada slide.
const { color, font } = tokens;

export default defineDeck(() => (
  <Deck>
    <ContentLayout title="Prioridades do próximo trimestre">
      <Bullets
        size={28}
        items={[
          'Migrar todos os serviços legados, inclusive relatórios regulatórios, painéis da diretoria e integrações com parceiros, para a nova plataforma de dados até o fim do trimestre',
          'Reduzir em 30% o custo de infraestrutura por consulta, renegociando contratos de nuvem, consolidando clusters e desligando ambientes ociosos de homologação',
          'Publicar o catálogo de dados com dono, regras de qualidade e linhagem de cada tabela crítica, revisado mensalmente pelos responsáveis de cada domínio',
          'Treinar as áreas de negócio no self-service dos painéis e das consultas e medir a adoção semanalmente por área',
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Indicadores">
      <KpiRow
        items={[
          { label: 'Receita', value: 'R$ 52.400.000,00', delta: '+14,2%', trend: 'up' },
          { label: 'Clientes ativos', value: '1.284.392', delta: '+8,1%', trend: 'up' },
          { label: 'Disponibilidade', value: '99,95%', delta: '+0,05 p.p.', trend: 'up' },
          { label: 'Tempo de resposta', value: '182 ms', delta: '−12 ms', trend: 'up' },
          { label: 'Chamados', value: '3.412', delta: '+22%', trend: 'down' },
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Linha do tempo">
      <Box direction="row" gap={24}>
        {['Planejamento', 'Migração', 'Validação', 'Desligamento'].map((phase, i) => (
          <Box width={200} shrink={0} padding={16} gap={6} fill={color.surface} radius={8}>
            <Text size={font.small} weight="bold" color={color.accent}>Etapa {i + 1}</Text>
            <Text size={font.h2} weight="bold" color={color.ink} fit="error">{phase}</Text>
          </Box>
        ))}
      </Box>
    </ContentLayout>
  </Deck>
));
