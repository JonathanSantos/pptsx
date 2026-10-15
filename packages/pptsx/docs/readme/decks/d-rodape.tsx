import { Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={44} gap={12} color="#1B2A4A">
      <Text fontSize={30} fontWeight="bold">Próximos passos</Text>
      <Text fontSize={20} color="#5B6680">
        Abrir o catálogo de dados para crédito e logística no Q4.
      </Text>
      <Text fontSize={12} color="#5B6680" marginTop="auto"
        paddingTop={10} borderTop="1px solid #CCD3E0">
        Fonte: plataforma de dados, setembro de 2026.
      </Text>
    </Slide>
  </Deck>
));
