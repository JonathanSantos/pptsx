import { Box, Deck, Shape, Text, defineDeck } from 'pptsx';
import { ContentLayout } from '@pptsx/ds-base';
import { Bullets, KpiRow } from '@pptsx/ds-base';
import { tokens } from '@pptsx/ds-base';

// Cópia corrigida de broken-original.tsx (teste M6): mesmas 4 prioridades,
// mesmos 5 indicadores e mesmas 4 fases, com textos enxutos e layout por grow.
const { color, font, space } = tokens;

const PRIORITIES = [
  'Migrar serviços legados (relatórios regulatórios, painéis e integrações) para a nova plataforma de dados',
  'Reduzir em 30% o custo de infraestrutura por consulta',
  'Publicar o catálogo de dados com dono, qualidade e linhagem',
  'Treinar as áreas no self-service e medir a adoção semanal',
] as const;

const PHASES = ['Planejamento', 'Migração', 'Validação', 'Desligamento'] as const;

// Marco da linha do tempo: círculo numerado + nome; a linha que liga os
// círculos é decoração absoluta no contêiner (Timeline).
const PhaseStep = ({ step, name }: { step: number; name: string }) => (
  <Box grow={1} gap={8} align="center">
    <Box width={44} height={44} shrink={0} radius={22} fill={color.accent} justify="center" align="center">
      <Text size={font.body} weight="bold" color={color.white} align="center">{step}</Text>
    </Box>
    <Text size={font.small} weight="bold" color={color.accent} align="center">Etapa {step}</Text>
    <Text size={font.body} weight="bold" color={color.ink} align="center">{name}</Text>
  </Box>
);

const Timeline = ({ phases }: { phases: readonly string[] }) => (
  <Box direction="row" gap={space.tight}>
    <Shape kind="rect" position="absolute" left="12%" top={21} width="76%" height={2} fill={color.accent} />
    {phases.map((phase, i) => (
      <PhaseStep step={i + 1} name={phase} />
    ))}
  </Box>
);

type Kpi = Parameters<typeof KpiRow>[0]['items'][number];

// Unidade no rótulo para o valor ser só número curto (não quebra no cartão).
const KPIS: readonly Kpi[] = [
  { label: 'Receita (R$ mi)', value: '52,4', delta: '+14,2%', trend: 'up' },
  { label: 'Clientes ativos (mi)', value: '1,28', delta: '+8,1%', trend: 'up' },
  { label: 'Disponibilidade (%)', value: '99,95', delta: '+0,05 p.p.', trend: 'up' },
  { label: 'Tempo de resposta (ms)', value: '182', delta: '−12 ms', trend: 'down', sentiment: 'positive' },
  { label: 'Chamados', value: '3.412', delta: '+22%', trend: 'up', sentiment: 'negative' },
];

// 16:9: uma linha de 5 cartões pequenos; 4:3: 3 + 2 cartões médios usando a altura extra.
const Kpis = ({ stacked }: { stacked: boolean }) =>
  stacked ? (
    <Box gap={space.gap}>
      <KpiRow size="md" items={KPIS.slice(0, 3)} />
      <KpiRow size="md" items={KPIS.slice(3)} />
    </Box>
  ) : (
    <KpiRow size="sm" items={KPIS} />
  );

export default defineDeck((ctx) => (
  <Deck>
    <ContentLayout title="Prioridades do próximo trimestre" justify="center">
      <Bullets size={ctx.aspect < 1.5 ? 24 : 22} items={PRIORITIES} />
    </ContentLayout>

    <ContentLayout title="Indicadores" justify="center">
      <Kpis stacked={ctx.aspect < 1.5} />
    </ContentLayout>

    <ContentLayout title="Linha do tempo" justify="center">
      <Timeline phases={PHASES} />
    </ContentLayout>
  </Deck>
));
