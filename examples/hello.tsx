import { Box, Deck, Image, Shape, Slide, Text, defineDeck } from 'pptsx';

// M1: coordenadas manuais (position="absolute"); o layout automático chega no M2.
// Em CSS: absoluto mede pelo pai; sem zIndex, cada nó pinta na ordem do código.
const Title = ({ children }: { children: string }) => (
  <Text position="absolute" left={48} top={40} width={624} fontSize={40} fontWeight="bold" color="#1B2A4A">
    {children}
  </Text>
);

export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor="#FFFFFF" notes="Slide de hello world do M1">
      <Shape kind="rect" position="absolute" left={0} top={0} width={12} height="100%" backgroundColor="#2F6FED" />
      <Title>Hello, pptsx</Title>
      <Text position="absolute" left={48} top={110} width={300} fontSize={18} color="#44506A">
        Texto, shape e imagem posicionados à mão para validar a emissão crua.
      </Text>
      <Shape kind="ellipse" position="absolute" left={48} top={220} width={80} height={80} backgroundColor="#F2A541" />
      {/* Shape: radius (roundRect) e stroke/strokeWidth (linha da forma) são props da própria forma. */}
      <Shape kind="roundRect" position="absolute" left={150} top={220} width={160} height={80} radius={12}
        backgroundColor="#E8EEFC" stroke="#2F6FED" strokeWidth={2} />
      <Shape kind="line" position="absolute" left={48} top={330} width={262} height={0} stroke="#1B2A4A" strokeWidth={2} />
      <Box position="absolute" left={380} top={110} width={300} height={190} backgroundColor="#F4F6FA" borderRadius={8}>
        <Image src="./assets/chart.png" position="absolute" left={10} top={10} width={280} height={170} objectFit="contain" />
      </Box>
    </Slide>
  </Deck>
));
