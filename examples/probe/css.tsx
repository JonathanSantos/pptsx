import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

// M11 (PoC P2): sondagem dos estouros que só existem no modelo CSS. Sai com exit 1 de propósito
// (7 diagnósticos em 16x9; tests/fit/css-diagnostics.test.tsx confere cada um).
// 1. grid com linhas fixas: texto encolhe na célula; Box alinhado no topo passa da célula.
// 2. wrap numa caixa de altura fixa: as linhas de tags não cabem.
// 3. margens e borda contam: os filhos cabem pelo frame, mas não pela caixa de margem/área de conteúdo.
const ink = '#1B2A4A';
const LONG = 'Pipelines legados migrados antes do prazo, com custo por consulta 22% menor e disponibilidade acima da meta em todas as áreas.';

export default defineDeck(() => (
  <Deck>
    <Slide padding={32} color={ink}>
      <Text fontSize={20} fontWeight="bold" marginBottom={12}>
        Grid com linhas fixas
      </Text>
      <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gridTemplateRows="60px 60px" gap={10}>
        <Text fontSize={14} backgroundColor="#F4F6FA">
          {LONG}
        </Text>
        <Text fontSize={14} fit="error" backgroundColor="#F4F6FA">
          {LONG}
        </Text>
        <Box alignSelf="start" backgroundColor="#E8EEFC" padding={8}>
          <Text fontSize={12}>Cartão alinhado no topo</Text>
          <Box height={70} backgroundColor="#2F6FED" />
        </Box>
        <Text fontSize={14}>Curto</Text>
      </Box>
    </Slide>

    <Slide padding={32} color={ink}>
      <Text fontSize={20} fontWeight="bold" marginBottom={12}>
        Wrap sem altura para as linhas
      </Text>
      <Box display="flex" flexWrap="wrap" gap={8} height={60} alignContent="flex-start">
        {['receita', 'custo', 'NPS', 'churn', 'uptime', 'catálogo', 'crédito', 'logística', 'seguros', 'marketing', 'corporativo', 'varejo', 'dados', 'pipelines'].map((tag) => (
          <Text key={tag} fontSize={14} padding="6 12" backgroundColor="#E8EEFC" borderRadius={10}>
            {tag}
          </Text>
        ))}
      </Box>
    </Slide>

    <Slide padding={32} color={ink}>
      <Text fontSize={20} fontWeight="bold" marginBottom={12}>
        Margens e borda contam
      </Text>
      <Box height={100} backgroundColor="#F4F6FA">
        <Box height={40} marginTop={20} flexShrink={0} backgroundColor="#E8EEFC" />
        <Box height={40} marginBottom={20} flexShrink={0} backgroundColor="#E8EEFC" />
      </Box>
      <Box height={60} width={300} border="6px solid #2F6FED" padding={10} marginTop={20}>
        <Text fontSize={14} fit="error">
          Texto que cabe no frame de 60 pt mas não na área de conteúdo de 28 pt.
        </Text>
      </Box>
    </Slide>
  </Deck>
));
