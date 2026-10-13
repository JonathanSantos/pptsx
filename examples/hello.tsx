import { Box, Deck, Image, Shape, Slide, Text, defineDeck } from 'tsx-slides';

// M1: coordenadas manuais (position="absolute"); o layout automático chega no M2.
const Title = ({ children }: { children: string }) => (
  <Text position="absolute" left={48} top={40} width={624} size={40} weight="bold" color="#1B2A4A">
    {children}
  </Text>
);

export default defineDeck(() => (
  <Deck>
    <Slide background="#FFFFFF" notes="Slide de hello world do M1">
      <Shape kind="rect" position="absolute" left={0} top={0} width={12} height="100%" fill="#2F6FED" />
      <Title>Hello, tsx-slides</Title>
      <Text position="absolute" left={48} top={110} width={300} size={18} color="#44506A">
        Texto, shape e imagem posicionados à mão para validar a emissão crua.
      </Text>
      <Shape kind="ellipse" position="absolute" left={48} top={220} width={80} height={80} fill="#F2A541" />
      <Shape kind="roundRect" position="absolute" left={150} top={220} width={160} height={80} radius={12} fill="#E8EEFC" stroke="#2F6FED" strokeWidth={2} />
      <Shape kind="line" position="absolute" left={48} top={330} width={262} height={0} stroke="#1B2A4A" strokeWidth={2} />
      <Box position="absolute" left={380} top={110} width={300} height={190} fill="#F4F6FA" radius={8}>
        <Image src="./assets/chart.png" position="absolute" left={10} top={10} width={280} height={170} fit="contain" />
      </Box>
    </Slide>
  </Deck>
));
