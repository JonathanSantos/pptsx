import { Box, Chart, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';
import { Branch, Figure, Landscape, Overline, Serif } from './components.tsx';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const PROJECTS = [
  { name: 'Corredor do Mico-Leão', where: 'Silva Jardim · RJ', text: 'Liga dois fragmentos de mata com 14 km de floresta replantada.', sky: 'sage', sun: 'clay', hills: ['moss', 'forest'] },
  { name: 'Nascentes do Una', where: 'Bonito · PE', text: '212 nascentes cercadas e protegidas, com a água de volta em 160.', sky: 'sand', sun: 'moss', hills: ['clay', 'bark'] },
  { name: 'Viveiro Escola', where: 'Ubatuba · SP', text: 'Jovens da região produzem 300 mil mudas nativas por ano.', sky: 'forest', sun: 'cream', hills: ['sage', 'moss'] },
] as const;

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: floresta escura, ramo de folhas giradas à direita, título em Big Caslon. */}
    <Slide backgroundColor={color.forest} color={color.cream} padding={`0 ${space.page}`} justifyContent="center" gap={10}>
      <Shape kind="ellipse" position="absolute" zIndex={-1} left={420} top={-120} width={420} height={420} backgroundColor={color.cream} opacity={0.05} />
      <Branch left={600} top={40} height={330} tones={['moss', 'sage', 'clay', 'moss', 'sage', 'moss']} />
      <Overline>Fundação Mata Viva</Overline>
      <Serif size={font.hero} tone="cream">Relatório de Impacto</Serif>
      <Serif size={font.hero} tone="clay">2026</Serif>
      <Text fontFamily="Inter" fontSize={12} color={color.sage} width={330} lineHeight={1.45} marginTop={6}>
        Um ano restaurando a Mata Atlântica com quem vive nela: viveiros, nascentes e corredores de floresta.
      </Text>
    </Slide>

    {/* 2 · Números: três figuras em Caslon sobre fio e as emissões evitadas num gráfico empilhado. */}
    <Slide backgroundColor={color.sand} color={color.ink} padding={`32 ${space.page}`} gap={18}>
      <Box gap={6}>
        <Overline>O ano em números</Overline>
        <Serif>Mais floresta, mais água, menos carbono</Serif>
      </Box>
      <Box display="flex" gap={22}>
        <Figure value="1,2" unit="mi" label="mudas nativas plantadas, de 94 espécies" />
        <Figure value="4.800" unit="ha" label="em restauração ativa em três estados" tone="moss" />
        <Figure value="37" unit="mil t" label="de CO₂ removidas da atmosfera no ano" tone="clay" />
      </Box>
      <Box flex={1} backgroundColor={color.cream} borderRadius={12} padding="10 14">
        <Chart
          kind="stackedBar" flex={1} font="Inter" size={8.5} color={color.bark} title="CO₂ removido por frente (mil t)"
          colors={[color.forest, color.moss, color.clay]}
          data={{ categories: ['2022', '2023', '2024', '2025', '2026'], series: [
            { name: 'Corredores', values: [6, 9, 12, 15, 19] },
            { name: 'Nascentes', values: [2, 4, 6, 8, 10] },
            { name: 'Viveiros', values: [1, 2, 4, 6, 8] },
          ] }}
        />
      </Box>
    </Slide>

    {/* 3 · Projetos: cartões com paisagem abstrata feita de elipses. */}
    <Slide backgroundColor={color.cream} color={color.ink} padding={`32 ${space.page}`} gap={18}>
      <Box gap={6}>
        <Overline tone="moss">Onde trabalhamos</Overline>
        <Serif>Três projetos que mudaram o mapa</Serif>
      </Box>
      <Box display="grid" flex={1} gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={space.gap}>
        {PROJECTS.map(({ name, where, text, ...art }) => (
          <Box backgroundColor={color.sand} borderRadius={14} padding={10} gap={8}>
            <Landscape {...art} />
            <Box padding="2 6" gap={4}>
              <Overline tone="bark">{where}</Overline>
              <Serif size={18}>{name}</Serif>
              <Text fontFamily="Inter" fontSize={10} lineHeight={1.45} color={color.ink}>{text}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Slide>

    {/* 4 · Depoimento: fundo areia, folha grande e a citação em Caslon. */}
    <Slide backgroundColor={color.sand} color={color.forest} padding={`0 ${space.page * 1.4}`} justifyContent="center" gap={16}>
      <Branch left={640} top={-30} height={300} tones={['moss', 'forest', 'sage', 'moss']} />
      <Text fontFamily="Big Caslon" fontSize={90} lineHeight={0.8} color={color.clay}>“</Text>
      <Serif size={27}>A água voltou para a nascente atrás de casa depois de onze anos. Meu filho nunca tinha visto ela correr.</Serif>
      <Box display="flex" gap={10} alignItems="center">
        <Box width={26} height={2} backgroundColor={color.clay} />
        <Overline tone="bark">Dona Cida, agricultora em Bonito · PE</Overline>
      </Box>
    </Slide>
  </Deck>
));
