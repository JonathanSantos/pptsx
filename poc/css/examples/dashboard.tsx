import { Box, Deck, Slide, Text, defineDeck } from '../index.ts';

// P1: dashboard 3×2 de KPIs em grid (colunas fr, linhas auto). Em 4:3 vira 2×3 só trocando o template.
const ink = '#1B2A4A';
const muted = '#5B6680';
const accent = '#2F6FED';
const positive = '#1E9E6A';
const negative = '#D64545';

interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly good: boolean;
}

const KPIS: readonly Kpi[] = [
  { label: 'Receita (R$ mi)', value: '52,4', delta: '▲ +14,2% vs Q2', good: true },
  { label: 'Custo por consulta', value: '−22%', delta: '▼ menor do ano', good: true },
  { label: 'NPS interno', value: '62', delta: '▼ −4 pts vs Q2', good: false },
  { label: 'Churn de clientes', value: '1,8%', delta: '▼ −0,6 pp', good: true },
  { label: 'Disponibilidade', value: '99,95%', delta: 'meta: 99,9%', good: true },
  { label: 'Áreas no catálogo', value: '11', delta: '▲ +3 no trimestre', good: true },
];

const KpiCard = ({ label, value, delta, good }: Kpi) => (
  <Box backgroundColor="#F4F6FA" borderRadius={8} padding={14} borderTop={`3px solid ${accent}`}>
    <Text fontSize={12} color={muted}>
      {label}
    </Text>
    <Text fontSize={34} fontWeight="bold" marginTop={4} marginBottom={2}>
      {value}
    </Text>
    <Text fontSize={11} fontWeight="bold" color={good ? positive : negative}>
      {delta}
    </Text>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    <Slide padding={36} backgroundColor="#FFFFFF" color={ink} fontFamily="Arial">
      <Text fontSize={26} fontWeight="bold" paddingLeft={12} borderLeft={`4px solid ${accent}`} marginBottom={20}>
        Indicadores do trimestre
      </Text>
      <Box
        display="grid"
        gridTemplateColumns={{ base: 'repeat(3, 1fr)', tall: 'repeat(2, 1fr)' }}
        gridAutoRows="auto"
        gap={16}
      >
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </Box>
      <Box display="grid" gridTemplateColumns="auto 1fr" columnGap={12} marginTop="auto" alignItems="center">
        <Text fontSize={11} fontWeight="bold" color={accent}>
          FONTE
        </Text>
        <Text fontSize={11} color={muted}>
          Plataforma de dados, fechamento de 30/09/2026.
        </Text>
      </Box>
    </Slide>
  </Deck>
));
