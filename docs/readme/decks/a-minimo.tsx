import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={48} gap={20} color="#1B2A4A">
      <Text fontSize={40} fontWeight="bold">
        Olá, pptsx
      </Text>
      <Box flex={1} justifyContent="center" padding={32}
        backgroundColor="#F4F6FA" borderRadius={12}>
        <Text fontSize={28}>
          Sem coordenadas: o layout é CSS.
        </Text>
        <Text fontSize={16} color="#5B6680" marginTop={8}>
          Este Box ocupa o resto da altura (flex: 1).
        </Text>
      </Box>
    </Slide>
  </Deck>
));
