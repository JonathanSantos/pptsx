import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={56} justifyContent="center"
      backgroundColor="#1B2A4A" color="#FFFFFF">
      <Shape kind="ellipse" position="absolute" zIndex={-1}
        right={-110} top={-130} width={400} height={400}
        backgroundColor="#101B33" />
      <Box position="absolute" right={96} top={84}
        width={130} height={130} borderRadius={16}
        backgroundColor="#2F6FED" opacity={0.45} rotate={18} />
      <Box position="absolute" left={0} bottom={0}
        width="100%" height={8} backgroundColor="#2F6FED" />
      <Text fontSize={48} fontWeight="bold">Nova fase</Text>
      <Text fontSize={20} color="#C9D6F5" marginTop={8}>
        Decoração atrás, conteúdo na frente.
      </Text>
    </Slide>
  </Deck>
));
