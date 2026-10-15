// M11: cópia congelada de examples/layout-test.tsx do commit 7bf9fc7 (props antigas como alias do CSS), para a paridade
// com o motor pré-M11 (tests/examples/engine-parity, tests/emit/emit-parity). Assets via baseDir = examples/.
import { Box, Deck, Image, Shape, Slide, Text, defineDeck } from 'pptsx';

// M2: nenhuma coordenada manual; tudo vem do flexbox (exceto a decoração absoluta).
const palette = { ink: '#1B2A4A', muted: '#5B6680', accent: '#2F6FED', soft: '#E8EEFC', warm: '#F2A541' };

const Card = ({ title, body }: { title: string; body: string }) => (
  <Box flex={1} padding={16} gap={8} backgroundColor={palette.soft} borderRadius={8}>
    <Text fontSize={18} fontWeight="bold" color={palette.ink}>{title}</Text>
    <Text fontSize={12} color={palette.muted}>{body}</Text>
  </Box>
);

const Header = ({ children }: { children: string }) => (
  <Box display="flex" alignItems="center" gap={12}>
    <Shape kind="rect" width={6} height={32} fill={palette.accent} />
    <Text fontSize={28} fontWeight="bold" color={palette.ink} flex={1}>{children}</Text>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={24} backgroundColor="#FFFFFF">
      <Header>Três colunas com grow e gap</Header>
      <Box display="flex" gap={16} flex={1}>
        <Card title="Flexbox" body="Caixas crescem e se distribuem sozinhas, sem coordenadas." />
        <Card title="Medição" body="O texto quebra em várias linhas e a altura acompanha o conteúdo medido." />
        <Card title="Preview" body="SVG e PNG saem da mesma árvore posicionada usada pelo PPTX." />
      </Box>
    </Slide>

    <Slide flexDirection="row" padding={40} gap={24} backgroundColor="#FFFFFF">
      <Shape kind="ellipse" position="absolute" right={-60} top={-60} width="30%" height="50%" fill={palette.soft} />
      <Box width="45%" justifyContent="center" gap={12}>
        <Header>Imagem com contain e cover</Header>
        <Text fontSize={14} color={palette.muted}>
          À direita, a mesma imagem 3:2 em duas caixas de proporções diferentes. Contain deve mostrar a borda inteira; cover deve cortar.
        </Text>
      </Box>
      <Box flex={1} gap={16}>
        <Box flex={1} backgroundColor="#F4F6FA" outline={`1px solid ${palette.muted}`}>
          <Image src="./assets/frame-3x2.png" objectFit="contain" flex={1} />
        </Box>
        <Box flex={1} backgroundColor="#F4F6FA" outline={`1px solid ${palette.muted}`}>
          <Image src="./assets/frame-3x2.png" objectFit="cover" flex={1} />
        </Box>
      </Box>
    </Slide>

    <Slide padding={40} gap={16} justifyContent="space-between" backgroundColor="#FFFFFF">
      <Header>Alinhamentos</Header>
      <Box display="flex" justifyContent="space-between" alignItems="flex-end" height={80} backgroundColor="#F4F6FA">
        <Shape kind="rect" width={60} height={30} fill={palette.accent} />
        <Shape kind="roundRect" width={60} height={50} radius={10} fill={palette.warm} />
        <Shape kind="ellipse" width={60} height={70} fill={palette.ink} />
      </Box>
      <Box display="flex" gap={16}>
        <Text fontSize={14} textAlign="left" flex={1} color={palette.ink}>Esquerda</Text>
        <Text fontSize={14} textAlign="center" flex={1} color={palette.ink}>Centro</Text>
        <Text fontSize={14} textAlign="right" flex={1} color={palette.ink}>Direita</Text>
      </Box>
      <Shape kind="line" height={0} />
    </Slide>
  </Deck>
));
