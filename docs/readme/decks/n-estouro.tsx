import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={16} color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold">Resumo executivo</Text>
      <Box height={110} padding={16} backgroundColor="#F4F6FA">
        <Text fontSize={20} fit="error">
          A plataforma migrou os pipelines legados antes do prazo, reduziu o custo
          por consulta em 22% com o novo cache e abriu o catálogo para três áreas
          novas, mantendo a disponibilidade acima da meta em todos os meses.
        </Text>
      </Box>
    </Slide>
  </Deck>
));
