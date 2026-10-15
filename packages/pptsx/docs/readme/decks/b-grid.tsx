import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

const kpis = [
  ['Receita (R$\u00A0mi)', '52,4', '▲ +14,2%'],
  ['Clientes ativos', '1.284', '▲ +86'],
  ['NPS', '62', '▼ −4 pts'],
  ['Churn', '1,8%', '▼ −0,6 pp'],
  ['Disponibilidade', '99,95%', 'meta 99,9%'],
  ['Áreas no catálogo', '11', '▲ +3'],
];

export default defineDeck(() => (
  <Deck>
    <Slide padding={36} gap={18} backgroundColor="#F4F6FA" color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold">Indicadores</Text>
      <Box display="grid" gap={16} flex={1}
        gridTemplateColumns="repeat(3, minmax(0, 1fr))"
        gridAutoRows="minmax(0, 1fr)">
        {kpis.map(([label, value, delta]) => (
          <Box backgroundColor="#FFFFFF" borderRadius={10}
            padding={18} fontSize={14} color="#5B6680"
            justifyContent="center"
            boxShadow="0 3px 10px rgba(27,42,74,0.18)">
            <Text>{label}</Text>
            <Text fontSize={38} fontWeight="bold" color="#1B2A4A">
              {value}
            </Text>
            <Text fontWeight="bold" color="#2F6FED">{delta}</Text>
          </Box>
        ))}
      </Box>
    </Slide>
  </Deck>
));
