import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

const tags = ['TypeScript', 'TSX', 'flexbox', 'grid', 'margin: auto',
  'z-index', 'herança', 'bordas por lado', 'box-shadow', 'opacity',
  'rotate', 'breakpoints', 'paginação', 'gráficos nativos', 'tabelas',
  'diagnósticos', 'PPTX editável'];

export default defineDeck(() => (
  <Deck>
    <Slide padding={44} gap={22} color="#1B2A4A">
      <Text fontSize={28} fontWeight="bold">O que cabe num deck</Text>
      <Box display="flex" flexWrap="wrap" gap={12}>
        {tags.map((tag) => (
          <Text fontSize={20} padding="7 16" borderRadius={16}
            backgroundColor="#E8EEFC" color="#2F6FED">
            {tag}
          </Text>
        ))}
      </Box>
    </Slide>
  </Deck>
));
