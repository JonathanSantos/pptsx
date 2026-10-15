import { Box, Chart, Deck, Slide, Text, defineDeck } from 'pptsx';

const quarters = ['Q4', 'Q1', 'Q2', 'Q3'];

export default defineDeck(() => (
  <Deck>
    <Slide padding={36} gap={16} color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold">Gráficos nativos e editáveis</Text>
      <Box display="grid" gap={16} flex={1}
        gridTemplateColumns="repeat(3, minmax(0, 1fr))">
        <Chart kind="bar" title="Receita (R$ mi)" labels
          colors={['#2F6FED']}
          data={{ categories: quarters,
            series: [{ name: 'Receita', values: [38.2, 41.5, 45.9, 52.4] }] }} />
        <Chart kind="line" title="Latência p95 (ms)"
          colors={['#2F6FED', '#D64545']}
          data={{ categories: quarters, series: [
            { name: 'Com cache', values: [420, 310, 260, 220] },
            { name: 'Sem cache', values: [610, 600, 650, 630] }] }} />
        <Chart kind="pie" title="Receita nova"
          colors={['#2F6FED', '#1E9E6A', '#F59E0B', '#5B6680']}
          data={{ categories: ['Varejo', 'Crédito', 'Seguros', 'Outros'],
            series: [{ name: 'Q3', values: [4.0, 0.6, 0.7, 1.2] }] }} />
      </Box>
    </Slide>
  </Deck>
));
