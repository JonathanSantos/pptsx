import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={20} color="#1B2A4A" fontSize={16}>
      <Text fontSize={28} fontWeight="bold">Herança de texto</Text>
      <Box display="flex" gap={20} flex={1} textAlign="center">
        <Box flex={1} justifyContent="center" borderRadius={12}
          backgroundColor="#1B2A4A" color="#FFFFFF">
          <Text letterSpacing={2} textTransform="uppercase">receita</Text>
          <Text fontSize={56} fontWeight="bold">52,4</Text>
          <Text color="#9DB8F5">R$ mi no Q3</Text>
        </Box>
        <Box flex={1} justifyContent="center" borderRadius={12}
          backgroundColor="#E8EEFC" color="#2F6FED">
          <Text letterSpacing={2} textTransform="uppercase">clientes</Text>
          <Text fontSize={56} fontWeight="bold">1.284</Text>
          <Text color="#5B6680">ativos no mês</Text>
        </Box>
      </Box>
      <Text color="#5B6680">
        Cor, tamanho e alinhamento são declarados uma vez no cartão.
      </Text>
    </Slide>
  </Deck>
));
