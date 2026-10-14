import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

// Cada instância de componente é um escopo de shrink: só encolhe quem não coube.
const Quote = ({ width }: { width: number }) => (
  <Box width={width} height={150} padding={16} backgroundColor="#F4F6FA">
    <Text fontSize={22} minSize={12}>
      O catálogo de dados reduziu pela metade o tempo para achar uma tabela confiável.
    </Text>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={20} color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold">fit="shrink" (padrão)</Text>
      <Box display="flex" gap={24} alignItems="flex-start">
        <Quote width={400} />
        <Quote width={180} />
      </Box>
    </Slide>
  </Deck>
));
