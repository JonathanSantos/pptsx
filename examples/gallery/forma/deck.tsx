import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';
import { Display, Label, NumberBlock, Portrait, Session, type Primary } from './components.tsx';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const page = { backgroundColor: color.paper, color: color.black, fontFamily: 'Inter' } as const;

const DAYS: readonly { day: string; date: string; tone: Primary; sessions: readonly [string, string, string][] }[] = [
  { day: 'Qui', date: '12', tone: 'red', sessions: [['09:00', 'Abertura: a forma segue o dado', 'Lina Bo · Porto'], ['10:30', 'Tipografia para telas pequenas', 'Kenji Mori · Tóquio'], ['14:00', 'Grid como argumento', 'Ana Weber · Berlim']] },
  { day: 'Sex', date: '13', tone: 'blue', sessions: [['09:00', 'Cor que funciona no projetor', 'Rui Faria · Lisboa'], ['11:00', 'Design systems sem marca', 'Clara Nunes · Recife'], ['15:30', 'Oficina: cartaz em uma hora', 'Coletivo Prumo']] },
  { day: 'Sáb', date: '14', tone: 'yellow', sessions: [['10:00', 'Movimento e geometria', 'Olu Adeyemi · Lagos'], ['13:30', 'O slide como peça gráfica', 'Marta Lins · Porto Alegre'], ['16:00', 'Encerramento e festa', 'Praça da Matriz']] },
];

const SPEAKERS: readonly { name: string; role: string; bg: Primary; head: Primary; body: Primary }[] = [
  { name: 'Lina Bo', role: 'Arquiteta · Porto', bg: 'yellow', head: 'black', body: 'red' },
  { name: 'Kenji Mori', role: 'Tipógrafo · Tóquio', bg: 'blue', head: 'yellow', body: 'black' },
  { name: 'Ana Weber', role: 'Designer · Berlim', bg: 'red', head: 'black', body: 'yellow' },
  { name: 'Olu Adeyemi', role: 'Animador · Lagos', bg: 'black', head: 'red', body: 'blue' },
];

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: composição de círculo, retângulo, triângulo e fios pretos à direita; título em DIN gigante. */}
    <Slide {...page} padding={space.page} justifyContent="center">
      <Box position="absolute" left={400} top={0} width={12} height={405} backgroundColor={color.black} />
      <Shape kind="ellipse" position="absolute" left={430} top={-60} width={280} height={280} backgroundColor={color.red} />
      <Box position="absolute" left={570} top={170} width={150} height={235} backgroundColor={color.blue} />
      <Shape kind="triangle" position="absolute" left={440} top={238} width={170} height={150} backgroundColor={color.yellow} />
      <Shape kind="ellipse" position="absolute" left={640} top={110} width={40} height={40} backgroundColor={color.black} />
      <Box position="absolute" left={412} top={226} width={308} height={10} backgroundColor={color.black} />
      <Label>Congresso de design · 2026</Label>
      <Box display="flex" alignItems="flex-end" gap={6} marginTop={4}>
        <Display size={font.giant}>Forma</Display>
      </Box>
      <Display size={font.giant} tone="red">26</Display>
      <Text fontSize={13} fontWeight="bold" marginTop={14}>Porto Alegre · 12 a 14 de novembro</Text>
      <Text fontSize={10} color="#55504A" marginTop={2}>Três dias, 48 palestras, uma praça cheia.</Text>
    </Slide>

    {/* 2 · Programa: três colunas com cabeçalho de cor e sessões separadas por fio preto. */}
    <Slide {...page} padding={`30 ${space.page} 28`} gap={16}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-end">
        <Display size={font.display}>Programa</Display>
        <Label>Auditório Araújo Vianna</Label>
      </Box>
      <Box display="grid" flex={1} gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={16}>
        {DAYS.map(({ day, date, tone, sessions }) => (
          <Box gap={9}>
            <Box display="flex" alignItems="flex-end" justifyContent="space-between" padding="10 12 6" backgroundColor={color[tone]}>
              <Display size={34} tone={tone === 'yellow' ? 'black' : undefined}>{day}</Display>
              <Text fontFamily="DIN Condensed" fontSize={46} lineHeight={1.2} color={tone === 'yellow' ? color.black : color.white}>{date}</Text>
            </Box>
            {sessions.map(([time, title, who]) => (
              <Session time={time} title={title} who={who} />
            ))}
          </Box>
        ))}
      </Box>
    </Slide>

    {/* 3 · Palestrantes: retratos geométricos em quatro colunas. */}
    <Slide {...page} padding={`30 ${space.page} 30`} gap={18}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-end">
        <Display size={font.display}>Quem fala</Display>
        <Shape kind="ellipse" width={26} height={26} backgroundColor={color.red} />
      </Box>
      <Box display="grid" flex={1} gridTemplateColumns="repeat(4, minmax(0, 1fr))" gap={14} alignItems="flex-start">
        {SPEAKERS.map(({ name, role, ...portrait }) => (
          <Box gap={8}>
            <Portrait {...portrait} />
            <Display size={26}>{name}</Display>
            <Label>{role}</Label>
          </Box>
        ))}
      </Box>
      <Box display="flex" gap={6}>
        {(['red', 'blue', 'yellow', 'black'] as const).map((tone) => (
          <Box flex={1} height={8} backgroundColor={color[tone]} />
        ))}
      </Box>
    </Slide>

    {/* 4 · Números: mosaico com spans no grid, cada bloco numa primária. */}
    <Slide {...page} padding={space.page} gap={space.gap}>
      <Box display="grid" flex={1} gap={space.gap} gridTemplateColumns="repeat(4, minmax(0, 1fr))" gridTemplateRows="repeat(2, minmax(0, 1fr))">
        <NumberBlock value="1.200" label="pessoas na praça" tone="blue" span={2} />
        <NumberBlock value="48" label="palestras" tone="red" />
        <NumberBlock value="3" label="dias" tone="yellow" />
        <NumberBlock value="12" label="oficinas" tone="black" />
        <NumberBlock value="6" label="países" tone="paper" />
        <NumberBlock value="1" label="praça cheia" tone="red" span={2} />
      </Box>
    </Slide>
  </Deck>
));
