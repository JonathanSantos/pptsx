import { Box, Deck, Text, defineDeck } from 'pptsx';
import { ContentLayout } from '@pptsx/ds-base';
import { Bullets, KpiRow } from '@pptsx/ds-base';
import { tokens } from '@pptsx/ds-base';

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
        size={font.h2}
        items={[
          'Migrar legados (relatórios regulatórios, painéis, integrações) para a nova plataforma',
          'Cortar 30% do custo por consulta: renegociar nuvem, consolidar clusters',
          'Publicar catálogo com dono, qualidade e linhagem das tabelas críticas',
          'Treinar o negócio no self-service e medir a adoção semanal por área',
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Indicadores">
      <KpiRow
        size="sm"
        items={[
          { label: 'Receita (R$ mi)', value: '52,4', delta: '+14,2%', trend: 'up' },
          { label: 'Clientes (mi)', value: '1,28', delta: '+8,1%', trend: 'up' },
          { label: 'Uptime', value: '99,95%', delta: '+0,05 p.p.', trend: 'up' },
          { label: 'Resposta (ms)', value: '182', delta: '−12 ms', trend: 'up' },
          { label: 'Chamados', value: '3.412', delta: '+22%', trend: 'down' },
        ]}
      />
    </ContentLayout>

    <ContentLayout title="Linha do tempo">
      <Box display="flex" gap={12}>
        {['Planejamento', 'Migração', 'Validação', 'Desligamento'].map((phase, i) => (
          <Box flex={1} padding={10} gap={6} backgroundColor={color.surface} borderRadius={8}>
            <Text fontSize={font.small} fontWeight="bold" color={color.accent}>Etapa {i + 1}</Text>
            <Text fontSize={font.body - 2} fontWeight="bold" color={color.ink} fit="error">{phase}</Text>
          </Box>
        ))}
      </Box>
    </ContentLayout>
  </Deck>
));
