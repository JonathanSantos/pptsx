import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

// De propósito: duas propriedades sem de/para no PPTX viram o warning css-not-emitted.
export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={16} color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold">CSS sem de/para</Text>
      <Box height={120} padding={16} backgroundColor="#F4F6FA"
        overflow="hidden" style={{ filter: 'blur(2px)' }}>
        <Text fontSize={18}>O PPTX não recorta nem desfoca.</Text>
      </Box>
    </Slide>
  </Deck>
));
