import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';
import { BarRow, Chip, Eyebrow, Feature, Glow, Metric, Ring } from './components.tsx';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const page = { backgroundColor: color.void, color: color.text, fontFamily: 'Inter', padding: `40 ${space.page}` } as const;

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: brilho violeta em camadas, anel e o título grande com tracking negativo. */}
    <Slide {...page} justifyContent="center" gap={16}>
      <Glow cx={590} cy={110} size={460} tone="violet" />
      <Glow cx={470} cy={330} size={220} tone="cyan" />
      <Ring cx={590} cy={110} size={300} />
      <Ring cx={590} cy={110} size={420} tone="cyan" />
      <Eyebrow>Lançamento · outubro de 2026</Eyebrow>
      <Text fontSize={font.hero} fontWeight="bold" letterSpacing={-3.5} lineHeight={0.95}>Orbit 3.0</Text>
      <Text fontSize={17} color={color.muted} lineHeight={1.35} width={380}>
        O banco de dados vetorial que responde antes de a pergunta terminar.
      </Text>
      <Box display="flex" gap={8} marginTop={10}>
        <Chip tone="cyan">12× mais rápido</Chip>
        <Chip tone="violet">Busca híbrida</Chip>
        <Chip tone="lime">Open source</Chip>
      </Box>
    </Slide>

    {/* 2 · Benchmarks: três métricas e um gráfico nativo de barras horizontais. */}
    <Slide {...page} gap={space.gap}>
      <Glow cx={720} cy={0} size={300} tone="violet" />
      <Box gap={6}>
        <Eyebrow tone="violet">Benchmarks · 10 milhões de vetores</Eyebrow>
        <Text fontSize={font.h1} fontWeight="bold" letterSpacing={-1}>Mais rápido em tudo que importa</Text>
      </Box>
      <Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={space.gap}>
        <Metric label="p99 da busca" value="4,2 ms" note="v2.4: 51 ms" tone="cyan" />
        <Metric label="Ingestão" value="1,8 M/s" note="9× a versão anterior" tone="violet" />
        <Metric label="Custo por consulta" value="−63%" note="mesmo hardware" tone="lime" />
      </Box>
      <Box flex={1} backgroundColor={color.surface} border={`1px solid ${color.line}`} borderRadius={14} padding="14 20" gap={9} justifyContent="center">
        <Text fontFamily="Andale Mono" fontSize={font.micro} color={color.muted} letterSpacing={1.5}>P99 DA BUSCA · MENOR É MELHOR</Text>
        <BarRow label="Orbit 3.0" value={4.2} max={66} unit="ms" hot />
        <BarRow label="Concorrente A" value={38} max={66} unit="ms" />
        <BarRow label="Orbit 2.4" value={51} max={66} unit="ms" />
        <BarRow label="Concorrente B" value={66} max={66} unit="ms" />
      </Box>
    </Slide>

    {/* 3 · Recursos: grade 3 × 2 de cartões com ícone em forma nativa. */}
    <Slide {...page} gap={space.gap + 4}>
      <Glow cx={0} cy={405} size={320} tone="pink" />
      <Box gap={6}>
        <Eyebrow tone="pink">Plataforma</Eyebrow>
        <Text fontSize={font.h1} fontWeight="bold" letterSpacing={-1}>Uma base, seis peças</Text>
      </Box>
      <Box display="grid" flex={1} gridTemplateColumns="repeat(3, minmax(0, 1fr))" gridAutoRows="minmax(0, 1fr)" gap={12}>
        <Feature icon="hexagon" tone="cyan" title="Índices HNSW" text="Grafos navegáveis em disco, com recall acima de 0,98." />
        <Feature icon="star" tone="violet" title="Busca híbrida" text="Vetor e palavra-chave numa consulta só, com pesos." />
        <Feature icon="diamond" tone="lime" title="Filtros exatos" text="Metadados filtrados antes da busca, sem perder recall." />
        <Feature icon="pentagon" tone="pink" title="Multitenant" text="Milhares de coleções isoladas no mesmo cluster." />
        <Feature icon="octagon" tone="cyan" title="Réplicas" text="Leitura em qualquer região, escrita consistente." />
        <Feature icon="chevron" tone="violet" title="Streaming" text="Ingestão contínua do Kafka, visível em 200 ms." />
      </Box>
    </Slide>

    {/* 4 · Fechamento: centralizado, com o comando de instalação num bloco mono. */}
    <Slide {...page} justifyContent="center" alignItems="center" gap={14}>
      <Glow cx={360} cy={200} size={520} tone="violet" />
      <Ring cx={360} cy={200} size={360} tone="cyan" />
      <Ring cx={360} cy={200} size={250} />
      <Eyebrow tone="lime">Disponível hoje · Apache 2.0</Eyebrow>
      <Text fontSize={56} fontWeight="bold" letterSpacing={-2.5}>orbit.dev/3</Text>
      <Box backgroundColor={color.surface} border={`1px solid ${color.line}`} borderRadius={10} padding="9 16" marginTop={6}>
        <Text fontFamily="Andale Mono" fontSize={12} color={color.cyan}>$ npm install @orbit/client@3</Text>
      </Box>
    </Slide>
  </Deck>
));
