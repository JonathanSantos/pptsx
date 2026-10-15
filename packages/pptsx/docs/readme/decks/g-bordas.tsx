import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={44} gap={24} color="#1B2A4A" fontSize={20}>
      <Text fontSize={30} fontWeight="bold"
        borderLeft="6px solid #2F6FED" paddingLeft={14}>
        Bordas por lado
      </Text>
      <Text color="#5B6680" paddingBottom={14}
        borderBottom="1px solid #CCD3E0">
        A barra do título é a borda esquerda do próprio Text;
        a divisória abaixo, a borda de baixo deste.
      </Text>
      <Box display="grid" gap={18}
        gridTemplateColumns="repeat(3, minmax(0, 1fr))">
        <Box padding={18} backgroundColor="#F4F6FA"
          borderTop="5px solid #1E9E6A">
          <Text>borderTop como faixa de status</Text>
        </Box>
        <Box padding={18} borderBottom="2px dashed #5B6680">
          <Text>borderBottom tracejada como divisória</Text>
        </Box>
        <Box padding={18} borderRadius={10}
          border="2px dotted #F59E0B">
          <Text>border pontilhada, com raio</Text>
        </Box>
      </Box>
    </Slide>
  </Deck>
));
