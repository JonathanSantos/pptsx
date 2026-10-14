import { B, Box, Chart, Deck, Shape, Slide, Span, Text, defineDeck } from '../index.ts';

// P3: vitrine da PoC CSS — cada slide exercita um grupo de features; validar no PowerPoint.
// grid (fr, auto, span, 1 / -1), wrap, margin auto, z-index, herança, bordas por lado,
// sombra, rotate, opacity e display none responsivo.
const ink = '#1B2A4A';
const muted = '#5B6680';
const accent = '#2F6FED';
const soft = '#E8EEFC';
const surface = '#F4F6FA';
const green = '#1E9E6A';
const red = '#D64545';
const amber = '#F59E0B';

const Title = ({ children }: { children: string }) => (
  <Text fontSize={26} fontWeight="bold" borderLeft={`5px solid ${accent}`} paddingLeft={12} marginBottom={18}>
    {children}
  </Text>
);

const Card = ({ label, value, delta, good }: { label: string; value: string; delta: string; good: boolean }) => (
  <Box backgroundColor="#FFFFFF" borderRadius={10} padding={14} boxShadow="0 3px 10px rgba(27,42,74,0.18)" fontSize={12} color={muted}>
    <Text>{label}</Text>
    <Text fontSize={30} fontWeight="bold" color={ink} marginTop={2}>
      {value}
    </Text>
    <Text fontWeight="bold" color={good ? green : red}>
      {delta}
    </Text>
  </Box>
);

const TAGS = ['grid', 'fr', 'auto', 'span', 'wrap', 'margin auto', 'z-index', 'herança', 'bordas por lado', 'sombra', 'rotate', 'opacity', 'display none'];

export default defineDeck(() => (
  <Deck>
    {/* 1. Capa: decoração atrás por z-index, texto herdado do Slide, rodapé por margin auto. */}
    <Slide backgroundColor={ink} padding={48} color="#FFFFFF" fontFamily="Arial">
      <Shape kind="ellipse" position="absolute" right={-90} top={-110} width={360} height={360} fill="#101B33" zIndex={-1} />
      <Box position="absolute" right={70} top={60} width={120} height={120} backgroundColor={accent} opacity={0.35} rotate={18} borderRadius={14} />
      <Text fontSize={13} fontWeight="bold" color="#9DB8F5" letterSpacing={2} textTransform="uppercase" marginTop="auto">
        PoC · motor de layout CSS
      </Text>
      <Text fontSize={44} fontWeight="bold" marginTop={10}>
        CSS de verdade, PPTX nativo
      </Text>
      <Text fontSize={20} color="#C9D6F5" marginTop={8} marginBottom={24}>
        Box model, flex, grid, z-index e herança — em memória
      </Text>
      <Text fontSize={11} color="#9DB8F5">
        Formas, textos e gráficos editáveis no PowerPoint
      </Text>
    </Slide>

    {/* 2. Grid de KPIs com sombra; em 4:3 vira 2 colunas e a nota só aparece lá. */}
    <Slide padding={36} backgroundColor={surface} color={ink}>
      <Title>Indicadores em grid</Title>
      <Box display="grid" gridTemplateColumns={{ base: 'repeat(3, 1fr)', tall: 'repeat(2, 1fr)' }} gap={16}>
        <Card label="Receita (R$ mi)" value="52,4" delta="▲ +14,2% vs Q2" good />
        <Card label="Custo por consulta" value="−22%" delta="▼ menor do ano" good />
        <Card label="NPS interno" value="62" delta="▼ −4 pts vs Q2" good={false} />
        <Card label="Churn" value="1,8%" delta="▼ −0,6 pp" good />
        <Card label="Disponibilidade" value="99,95%" delta="meta 99,9%" good />
        <Card label="Áreas no catálogo" value="11" delta="▲ +3" good />
      </Box>
      <Text fontSize={12} color={muted} display={{ base: 'none', tall: 'flex' }} marginTop={14}>
        Em 4:3 a grade passa a ter 2 colunas e esta nota aparece (display responsivo).
      </Text>
      <Text fontSize={11} color={muted} marginTop="auto">
        Fonte: plataforma de dados
      </Text>
    </Slide>

    {/* 3. Grid com auto, span e 1 / -1; gráfico nativo numa célula. */}
    <Slide padding={36} color={ink}>
      <Title>Grid com auto, span e gráfico</Title>
      <Box display="grid" gridTemplateColumns="auto 1fr 1fr" gridTemplateRows="auto 1fr" gap={14} flex={1}>
        <Box gridRow="span 2" backgroundColor={soft} padding={14} borderRadius={8} width={170}>
          <Text fontSize={14} fontWeight="bold">
            Coluna auto
          </Text>
          <Text fontSize={12} color={muted} marginTop={6}>
            Ocupa duas linhas (span 2); a largura vem do conteúdo.
          </Text>
        </Box>
        <Box gridColumn="2 / -1" padding="10 14" borderLeft={`4px solid ${green}`} backgroundColor={surface}>
          <Text fontSize={14}>
            Faixa do topo vai da coluna 2 até o fim (<B>2 / -1</B>).
          </Text>
        </Box>
        <Chart kind="bar" data={{ categories: ['Q4', 'Q1', 'Q2', 'Q3'], series: [{ name: 'Receita', values: [38.2, 41.5, 45.9, 52.4] }] }} colors={[accent]} showValues />
        <Chart kind="pie" data={{ categories: ['Varejo', 'Crédito', 'Seguros', 'Outros'], series: [{ name: 'Receita nova', values: [4, 0.6, 0.7, 1.2] }] }} />
      </Box>
    </Slide>

    {/* 4. Wrap, bordas por lado, decoração de texto e z-index sobreposto. */}
    <Slide padding={36} color={ink}>
      <Title>Wrap, bordas e camadas</Title>
      <Box display="flex" flexWrap="wrap" gap={8}>
        {TAGS.map((tag) => (
          <Text key={tag} fontSize={13} padding="5 12" backgroundColor={soft} color={accent} borderRadius={12}>
            {tag}
          </Text>
        ))}
      </Box>
      <Box display="flex" gap={16} marginTop={20} alignItems="flex-start">
        <Box flex={1} padding={12} borderTop={`4px solid ${accent}`} borderBottom="1px dashed #9AA3B5" backgroundColor={surface}>
          <Text fontSize={13}>
            Borda só em cima e tracejada embaixo; texto com <Span textDecoration="underline">sublinhado</Span> e <Span textDecoration="line-through">riscado</Span>.
          </Text>
        </Box>
        <Box flex={1} padding={12} border={`2px dotted ${amber}`}>
          <Text fontSize={13}>Borda pontilhada uniforme: o traço fica dentro da caixa, como no CSS.</Text>
        </Box>
        <Box width={180} height={110}>
          <Box position="absolute" left={0} top={0} width={110} height={70} backgroundColor={amber} zIndex={2} />
          <Box position="absolute" left={50} top={30} width={110} height={70} backgroundColor={green} zIndex={1} />
          <Box position="absolute" left={20} top={55} width={130} height={40} backgroundColor={ink} opacity={0.6} rotate={-8} zIndex={3} justifyContent="center" alignItems="center">
            <Text fontSize={12} fontWeight="bold" color="#FFFFFF">
              z 3 · −8°
            </Text>
          </Box>
        </Box>
      </Box>
      <Text fontSize={11} color={muted} marginTop="auto">
        As tags quebram em linhas (flexWrap); o rodapé fica no fim sem Box para empurrar.
      </Text>
    </Slide>
  </Deck>
));
