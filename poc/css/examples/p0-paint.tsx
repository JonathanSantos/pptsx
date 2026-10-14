import { Box, Deck, Shape, Slide, Span, Text, defineDeck } from '../index.ts';

// P0: pintura nova e box model em CSS — validação no Keynote (bordas por lado, sombra,
// opacity, rotate, z-index, decoração de texto, letterSpacing, margin auto, wrap, herança).
const ink = '#1B2A4A';
const accent = '#2F6FED';
const soft = '#E8EEFC';

const tags = ['flexbox', 'margin auto', 'wrap', 'z-index', 'herança', 'bordas por lado', 'sombra', 'rotate'];

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} backgroundColor="#FFFFFF" fontFamily="Arial" color={ink}>
      <Shape kind="ellipse" position="absolute" right={-80} top={-80} width={260} height={260} fill={soft} zIndex={-1} />
      <Text fontSize={30} fontWeight="bold" marginBottom={4}>
        Pintura CSS no PPTX
      </Text>
      <Text fontSize={12} letterSpacing={2} textTransform="uppercase" color="#5B6680" marginBottom={20}>
        box model · ordem de pintura · texto
      </Text>
      <Box display="flex" gap={16} marginBottom={20}>
        <Box flex={1} padding={14} backgroundColor="#F4F6FA" borderTop={`4px solid ${accent}`}>
          <Text fontSize={14} fontWeight="bold">Borda só em cima</Text>
          <Text fontSize={12}>Substitui o Shape de 6 pt.</Text>
        </Box>
        <Box flex={1} padding={14} backgroundColor="#FFFFFF" border="2px dashed #5B6680" borderRadius={8}>
          <Text fontSize={14} fontWeight="bold">Borda tracejada</Text>
          <Text fontSize={12}>Traço dentro da caixa.</Text>
        </Box>
        <Box flex={1} padding={14} backgroundColor="#FFFFFF" borderRadius={8} boxShadow="0 4px 12px rgba(27,42,74,0.25)">
          <Text fontSize={14} fontWeight="bold">Sombra</Text>
          <Text fontSize={12}>
            Uma <Span textDecoration="underline">sombra</Span> por forma; <Span textDecoration="line-through">spread</Span>.
          </Text>
        </Box>
      </Box>
      <Box display="flex" flexWrap="wrap" gap={8}>
        {tags.map((tag) => (
          <Text key={tag} fontSize={12} padding="4 10" backgroundColor={soft} borderRadius={10} color={accent}>
            {tag}
          </Text>
        ))}
      </Box>
      <Text fontSize={11} color="#5B6680" marginTop="auto">
        Rodapé com marginTop="auto": sem Box para empurrar.
      </Text>
    </Slide>

    <Slide padding={40} backgroundColor="#FFFFFF" color={ink}>
      <Text fontSize={28} fontWeight="bold" marginBottom={24}>
        Opacity, rotate e z-index
      </Text>
      <Box display="flex" gap={24} alignItems="center" flex={1}>
        <Box width={140} height={140} backgroundColor={accent} opacity={0.4} />
        <Box width={140} height={140} backgroundColor={accent} rotate={12} justifyContent="center" alignItems="center">
          <Text fontSize={16} fontWeight="bold" color="#FFFFFF">
            12°
          </Text>
        </Box>
        <Box width={180} height={140}>
          <Box position="absolute" left={0} top={0} width={110} height={90} backgroundColor="#F59E0B" zIndex={2} />
          <Box position="absolute" left={50} top={40} width={110} height={90} backgroundColor="#10B981" zIndex={1} />
        </Box>
      </Box>
      <Text fontSize={12} display={{ base: 'none', tall: 'flex' }} color="#5B6680">
        Esta linha só aparece em tamanhos "tall" (display none responsivo).
      </Text>
    </Slide>
  </Deck>
));
