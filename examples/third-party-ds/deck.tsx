import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';
import { Hero, Quote, StatCard } from './components.tsx';
import { tokens } from './tokens.ts';

const c = tokens.color;
const page = tokens.space.page;

const Title = ({ children }: { readonly children: string }) => (
  <Text fontSize={tokens.font.title} fontWeight="bold" color={c.ink}>{children}</Text>
);

export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor={c.ink}>
      <Hero title="Aurora 2026" subtitle="Resultados do ano e o que vem a seguir" />
    </Slide>

    <Slide backgroundColor={c.paper} padding={page} gap={tokens.space.gap}>
      <Title>Números do ano</Title>
      <Box flexDirection="row" gap={tokens.space.gap}>
        <StatCard label="Receita" value="R$ 52,4 mi" delta="+12%" />
        <StatCard label="Churn" value="3,1%" delta="-0,4 pp" />
        <StatCard label="NPS" value="62" delta="+8" tone="brand" size={{ base: 'md', tall: 'lg' }} />
      </Box>
      <Text fontSize={tokens.font.small} color={c.violet}>Fonte: relatório financeiro consolidado.</Text>
    </Slide>

    <Slide backgroundColor={c.paper} padding={page} gap={tokens.space.gap} justifyContent="center">
      <Quote text="O melhor ano da nossa história — e o próximo será maior." author="Ana Lima, CEO" />
    </Slide>

    <Slide backgroundColor={c.mist} padding={page} gap={tokens.space.gap} justifyContent="center">
      <Title>Obrigado</Title>
      <Text fontSize={tokens.font.body} color={c.ink}>Próximos passos: expansão para dois novos mercados no 1º semestre.</Text>
      <Box width={96} height={8} backgroundColor={c.aurora} />
    </Slide>
  </Deck>
));
