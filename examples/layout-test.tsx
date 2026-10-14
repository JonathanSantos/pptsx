import { Box, Deck, Image, Shape, Slide, Text, defineDeck } from 'pptsx';

// M2: nenhuma coordenada manual; tudo vem do flexbox (exceto a decoração absoluta).
const palette = { ink: '#1B2A4A', muted: '#5B6680', accent: '#2F6FED', soft: '#E8EEFC', warm: '#F2A541' };

const Card = ({ title, body }: { title: string; body: string }) => (
  <Box grow={1} padding={16} gap={8} fill={palette.soft} radius={8}>
    <Text size={18} weight="bold" color={palette.ink}>{title}</Text>
    <Text size={12} color={palette.muted}>{body}</Text>
  </Box>
);

const Header = ({ children }: { children: string }) => (
  <Box direction="row" align="center" gap={12}>
    <Shape kind="rect" width={6} height={32} fill={palette.accent} />
    <Text size={28} weight="bold" color={palette.ink} grow={1}>{children}</Text>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={24} background="#FFFFFF">
      <Header>Três colunas com grow e gap</Header>
      <Box direction="row" gap={16} grow={1}>
        <Card title="Flexbox" body="Caixas crescem e se distribuem sozinhas, sem coordenadas." />
        <Card title="Medição" body="O texto quebra em várias linhas e a altura acompanha o conteúdo medido." />
        <Card title="Preview" body="SVG e PNG saem da mesma árvore posicionada usada pelo PPTX." />
      </Box>
    </Slide>

    <Slide direction="row" padding={40} gap={24} background="#FFFFFF">
      <Shape kind="ellipse" position="absolute" right={-60} top={-60} width="30%" height="50%" fill={palette.soft} />
      <Box width="45%" justify="center" gap={12}>
        <Header>Imagem com contain e cover</Header>
        <Text size={14} color={palette.muted}>
          À direita, a mesma imagem 3:2 em duas caixas de proporções diferentes. Contain deve mostrar a borda inteira; cover deve cortar.
        </Text>
      </Box>
      <Box grow={1} gap={16}>
        <Box grow={1} fill="#F4F6FA" stroke={palette.muted}>
          <Image src="./assets/frame-3x2.png" fit="contain" grow={1} />
        </Box>
        <Box grow={1} fill="#F4F6FA" stroke={palette.muted}>
          <Image src="./assets/frame-3x2.png" fit="cover" grow={1} />
        </Box>
      </Box>
    </Slide>

    <Slide padding={40} gap={16} justify="between" background="#FFFFFF">
      <Header>Alinhamentos</Header>
      <Box direction="row" justify="between" align="end" height={80} fill="#F4F6FA">
        <Shape kind="rect" width={60} height={30} fill={palette.accent} />
        <Shape kind="roundRect" width={60} height={50} radius={10} fill={palette.warm} />
        <Shape kind="ellipse" width={60} height={70} fill={palette.ink} />
      </Box>
      <Box direction="row" gap={16}>
        <Text size={14} align="left" grow={1} color={palette.ink}>Esquerda</Text>
        <Text size={14} align="center" grow={1} color={palette.ink}>Centro</Text>
        <Text size={14} align="right" grow={1} color={palette.ink}>Direita</Text>
      </Box>
      <Shape kind="line" height={0} />
    </Slide>
  </Deck>
));
