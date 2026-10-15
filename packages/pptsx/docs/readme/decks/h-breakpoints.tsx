import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

const areas = ['Varejo', 'Crédito', 'Seguros', 'Logística', 'Marketing', 'Jurídico'];

export default defineDeck(() => (
  <Deck>
    <Slide padding={36} gap={16} backgroundColor="#F4F6FA" color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold">Um arquivo, dois formatos</Text>
      <Box display="grid" gap={16} flex={1}
        gridAutoRows="minmax(0, 1fr)"
        gridTemplateColumns={{
          base: 'repeat(3, minmax(0, 1fr))',
          tall: 'repeat(2, minmax(0, 1fr))',
        }}>
        {areas.map((area) => (
          <Box backgroundColor="#FFFFFF" padding={16}
            justifyContent="center" borderLeft="4px solid #2F6FED">
            <Text fontSize={20} fontWeight="bold">{area}</Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={13} color="#5B6680"
        display={{ base: 'none', tall: 'flex' }}>
        Esta nota só existe em 4:3, onde sobra altura.
      </Text>
    </Slide>
  </Deck>
));
