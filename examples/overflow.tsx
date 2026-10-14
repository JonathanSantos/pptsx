import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

// M4: slides lotados de propósito. Cada um deve terminar com fonte reduzida
// ou com diagnóstico — nunca com texto cortado em silêncio.
const ink = '#1B2A4A';
const accent = '#2F6FED';

const long =
  'Consolidamos a operação em três regiões, renegociamos contratos de infraestrutura, migramos os serviços críticos para a nova plataforma e reduzimos o tempo médio de entrega em quarenta por cento, mantendo a disponibilidade acima da meta durante todo o trimestre.';

const Header = ({ children }: { children: string }) => (
  <Box display="flex" alignItems="center" gap={12}>
    <Shape kind="rect" width={6} height={30} backgroundColor={accent} />
    <Text fontSize={26} fontWeight="bold" flex={1}>{children}</Text>
  </Box>
);

const Bullets = ({ items, size = 20 }: { items: readonly string[]; size?: number }) => (
  <Box gap={10} flex={1}>
    {items.map((item) => (
      <Box display="flex" gap={10} alignItems="flex-start">
        <Shape kind="ellipse" width={8} height={8} backgroundColor={accent} />
        <Text fontSize={size} minSize={12} flex={1}>{item}</Text>
      </Box>
    ))}
  </Box>
);

// A cor do texto vem do Slide (herança); cada slide declara só o que muda.
export default defineDeck(() => (
  <Deck>
    {/* 1 · shrink que cabe: bullets encolhem juntas (info), título intacto */}
    <Slide padding={36} gap={18} color={ink}>
      <Header>Bullets que encolhem juntas</Header>
      <Bullets items={[long, 'Novo modelo de atendimento com SLA por região e painel público.', long, 'Painel de indicadores publicado semanalmente para todas as áreas.']} />
    </Slide>

    {/* 2 · shrink que não cabe nem no mínimo: error com path */}
    <Slide padding={36} gap={18} color={ink}>
      <Header>Conteúdo demais para a área</Header>
      <Box flex={1} backgroundColor="#F4F6FA" padding={12}>
        <Text fontSize={20} minSize={19}>{[long, long, long].join(' ')}</Text>
      </Box>
    </Slide>

    {/* 3 · só truncate: selo amarelo (warning), nada de error */}
    <Slide padding={36} gap={18} color={ink}>
      <Header>Resumo com limite de linhas</Header>
      <Text fontSize={18} maxLines={3} fit="truncate">{[long, long].join(' ')}</Text>
    </Slide>

    {/* 4 · truncate (warning) e fit="error" (error) lado a lado */}
    <Slide padding={36} gap={18} color={ink}>
      <Header>Truncate e error</Header>
      <Box display="flex" gap={18} height={150}>
        <Box flex={1} backgroundColor="#F4F6FA" padding={12}>
          <Text fontSize={16} fit="truncate">{long}</Text>
        </Box>
        <Box flex={1} backgroundColor="#FDECEC" padding={12}>
          <Text fontSize={16} fit="error">{long}</Text>
        </Box>
      </Box>
      <Text fontSize={14} maxLines={1} fit="truncate">{long}</Text>
    </Slide>

    {/* 5 · box-overflow por tamanhos fixos + decoração absoluta que sai do slide (sem diagnóstico) */}
    <Slide padding={36} gap={18} color={ink}>
      <Shape kind="ellipse" position="absolute" right={-80} top={-80} width={240} height={240} backgroundColor="#E8EEFC" zIndex={-1} />
      <Header>Caixas fixas maiores que o espaço</Header>
      <Box display="flex" gap={16} height={200} backgroundColor="#F4F6FA">
        <Shape kind="rect" width={260} height={180} flexShrink={0} backgroundColor={accent} />
        <Shape kind="rect" width={260} height={180} flexShrink={0} backgroundColor={ink} />
        <Shape kind="rect" width={260} height={180} flexShrink={0} backgroundColor="#F2A541" />
      </Box>
    </Slide>
  </Deck>
));
