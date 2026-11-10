import { Box, Chart, Deck, Slide, Text, defineDeck } from 'pptsx';

const kpis = [
  { label: 'Receita', value: 'R$ 52,4 mi', delta: '+14%' },
  { label: 'Clientes ativos', value: '128 mil', delta: '+9%' },
  { label: 'NPS', value: '62', delta: '+4 pts' },
];

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={20} background="linear-gradient(135deg, #4F5BFF, #C246D8 55%, #FF6A3D)" color="#FFFFFF" justifyContent="flex-end">
      <Text fontSize={14} fontWeight="bold" letterSpacing={2} textTransform="uppercase">Diretoria · outubro</Text>
      <Text fontSize={48} fontWeight="bold" maxWidth="75%">Resultados do terceiro trimestre</Text>
    </Slide>
    <Slide padding={40} gap={20} backgroundColor="#FFFFFF" color="#0B1020">
      <Text fontSize={28} fontWeight="bold">Os três indicadores fecharam acima da meta</Text>
      <Box display="grid" gridTemplateColumns={{ base: 'repeat(3, minmax(0, 1fr))', tall: 'minmax(0, 1fr)' }} gap={16} flex={1}>
        {kpis.map((kpi) => (
          <Box backgroundColor="#EEF1FA" borderRadius={12} padding={20} gap={6} justifyContent="center">
            <Text fontSize={14} color="#5A6385">{kpi.label}</Text>
            <Text fontSize={36} fontWeight="bold" color="#4F5BFF" nowrap fitGroup="kpi">{kpi.value}</Text>
            <Text fontSize={14} fontWeight="bold" color="#14B87F">{kpi.delta}</Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={11} color="#5A6385">Fonte: relatório trimestral</Text>
    </Slide>
    <Slide padding={40} gap={20} backgroundColor="#FFFFFF" color="#0B1020">
      <Text fontSize={28} fontWeight="bold">A receita cresce há quatro trimestres</Text>
      <Chart kind="stackedBar" labels flex={1} colors={['#4F5BFF', '#FF6A3D']}
        data={{ categories: ['Q4', 'Q1', 'Q2', 'Q3'], series: [{ name: 'Recorrente', values: [21, 24, 28, 32] }, { name: 'Serviços', values: [15, 16, 18, 20] }] }} />
    </Slide>
  </Deck>
));
