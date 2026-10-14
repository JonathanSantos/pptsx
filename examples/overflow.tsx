import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

// M4: slides lotados de propósito. Cada um deve terminar com fonte reduzida
// ou com diagnóstico — nunca com texto cortado em silêncio.
const ink = '#1B2A4A';
const accent = '#2F6FED';

const long =
  'Consolidamos a operação em três regiões, renegociamos contratos de infraestrutura, migramos os serviços críticos para a nova plataforma e reduzimos o tempo médio de entrega em quarenta por cento, mantendo a disponibilidade acima da meta durante todo o trimestre.';

const Header = ({ children }: { children: string }) => (
  <Box direction="row" align="center" gap={12}>
    <Shape kind="rect" width={6} height={30} fill={accent} />
    <Text size={26} weight="bold" color={ink} grow={1}>{children}</Text>
  </Box>
);

const Bullets = ({ items, size = 20 }: { items: readonly string[]; size?: number }) => (
  <Box gap={10} grow={1}>
    {items.map((item) => (
      <Box direction="row" gap={10} align="start">
        <Shape kind="ellipse" width={8} height={8} fill={accent} />
        <Text size={size} minSize={12} grow={1} color={ink}>{item}</Text>
      </Box>
    ))}
  </Box>
);

export default defineDeck(() => (
  <Deck>
    {/* 1 · shrink que cabe: bullets encolhem juntas (info), título intacto */}
    <Slide padding={36} gap={18}>
      <Header>Bullets que encolhem juntas</Header>
      <Bullets items={[long, 'Novo modelo de atendimento com SLA por região e painel público.', long, 'Painel de indicadores publicado semanalmente para todas as áreas.']} />
    </Slide>

    {/* 2 · shrink que não cabe nem no mínimo: error com path */}
    <Slide padding={36} gap={18}>
      <Header>Conteúdo demais para a área</Header>
      <Box grow={1} fill="#F4F6FA" padding={12}>
        <Text size={20} minSize={19} color={ink}>{[long, long, long].join(' ')}</Text>
      </Box>
    </Slide>

    {/* 3 · só truncate: selo amarelo (warning), nada de error */}
    <Slide padding={36} gap={18}>
      <Header>Resumo com limite de linhas</Header>
      <Text size={18} maxLines={3} fit="truncate" color={ink}>{[long, long].join(' ')}</Text>
    </Slide>

    {/* 4 · truncate (warning) e fit="error" (error) lado a lado */}
    <Slide padding={36} gap={18}>
      <Header>Truncate e error</Header>
      <Box direction="row" gap={18} height={150}>
        <Box grow={1} fill="#F4F6FA" padding={12}>
          <Text size={16} fit="truncate" color={ink}>{long}</Text>
        </Box>
        <Box grow={1} fill="#FDECEC" padding={12}>
          <Text size={16} fit="error" color={ink}>{long}</Text>
        </Box>
      </Box>
      <Text size={14} maxLines={1} fit="truncate" color={ink}>{long}</Text>
    </Slide>

    {/* 5 · box-overflow por tamanhos fixos + decoração absoluta que sai do slide (sem diagnóstico) */}
    <Slide padding={36} gap={18}>
      <Shape kind="ellipse" position="absolute" right={-80} top={-80} width={240} height={240} fill="#E8EEFC" />
      <Header>Caixas fixas maiores que o espaço</Header>
      <Box direction="row" gap={16} height={200} fill="#F4F6FA">
        <Shape kind="rect" width={260} height={180} shrink={0} fill={accent} />
        <Shape kind="rect" width={260} height={180} shrink={0} fill={ink} />
        <Shape kind="rect" width={260} height={180} shrink={0} fill="#F2A541" />
      </Box>
    </Slide>
  </Deck>
));
