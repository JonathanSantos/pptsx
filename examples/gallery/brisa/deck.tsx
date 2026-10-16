import { Box, Chart, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';
import { Blob, Card, Goal, Stat, Tag } from './components.tsx';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const page = { backgroundColor: color.bg, color: color.ink, fontFamily: 'Inter' } as const;
const WEEK = [38, 52, 44, 70, 58, 86, 64];

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: bolhas pastel atrás e um cartão de saldo com sombra macia, como a tela do app. */}
    <Slide {...page} padding={`0 ${space.page}`} display="flex" flexDirection="row" alignItems="center" gap={34}>
      <Blob hue="lilac" left={430} top={-90} size={330} />
      <Blob hue="mint" left={560} top={230} size={230} />
      <Blob hue="peach" left={380} top={290} size={140} />
      <Box flex={1} gap={14}>
        <Tag hue="butter">Brisa · finanças pessoais</Tag>
        <Text fontSize={font.hero} fontWeight="bold" letterSpacing={-1.6} lineHeight={1.04}>Seu dinheiro, finalmente em ordem.</Text>
        <Text fontSize={14} color={color.soft} lineHeight={1.4}>Contas, metas e cartões num lugar só, com um resumo que cabe no café da manhã.</Text>
      </Box>
      <Box width={250}>
        <Card>
          <Text fontSize={font.small} color={color.soft}>Saldo disponível</Text>
          <Text fontSize={28} fontWeight="bold" letterSpacing={-1}>R$ 12.480,90</Text>
          <Box display="flex" alignItems="flex-end" gap={7} height={64} marginTop={8}>
            {WEEK.map((v, i) => (
              <Box flex={1} height={`${v}%`} borderRadius={5} backgroundColor={i === 5 ? color.lilacDeep : color.lilac} />
            ))}
          </Box>
          <Box display="flex" justifyContent="space-between" marginTop={2}>
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d) => (
              <Text flex={1} textAlign="center" fontSize={8} color={color.soft}>{d}</Text>
            ))}
          </Box>
          <Box marginTop={6}>
            <Tag hue="mint">+ R$ 840 este mês</Tag>
          </Box>
        </Card>
      </Box>
    </Slide>

    {/* 2 · Resumo do mês: rosca nativa num cartão branco e três estatísticas em pastel. */}
    <Slide {...page} padding={`32 ${space.page}`} gap={space.gap}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Text fontSize={font.h1} fontWeight="bold" letterSpacing={-0.8}>Outubro em um olhar</Text>
        <Tag hue="lilac">1 a 31 de outubro</Tag>
      </Box>
      <Box display="flex" flex={1} gap={space.gap}>
        <Card flex={1.4}>
          <Text fontSize={13} fontWeight="bold">Para onde foi</Text>
          <Chart
            kind="doughnut" flex={1} font="Inter" size={9} color={color.soft} holeSize={62} legend={{ position: 'right' }}
            colors={[color.lilacDeep, color.mintDeep, color.peachDeep, color.butterDeep, '#B9B2CC']}
            data={{ categories: ['Moradia', 'Mercado', 'Transporte', 'Lazer', 'Outros'], series: [{ name: 'Outubro', values: [2100, 1340, 620, 480, 310] }] }}
          />
        </Card>
        <Box flex={1} gap={space.gap}>
          <Stat hue="mint" label="Entrou" value="R$ 9.800" note="salário e dois freelas" />
          <Stat hue="peach" label="Saiu" value="R$ 4.850" note="12% menos que setembro" />
          <Stat hue="lilac" label="Guardado" value="R$ 4.950" note="50% da renda: recorde" />
        </Box>
      </Box>
    </Slide>

    {/* 3 · Metas: barras de progresso feitas de Box, com ícone em forma nativa. */}
    <Slide {...page} padding={`32 ${space.page}`} gap={12}>
      <Blob hue="butter" left={600} top={-80} size={200} />
      <Text fontSize={font.h1} fontWeight="bold" letterSpacing={-0.8}>Suas metas</Text>
      <Text fontSize={12} color={color.soft} marginTop={-6}>No ritmo de outubro, três delas fecham antes do fim do ano.</Text>
      <Box flex={1} gap={9} justifyContent="center">
        <Goal hue="mint" glyph="cloud" name="Viagem para Lisboa" saved={7200} target={9000} />
        <Goal hue="lilac" glyph="star" name="Reserva de emergência" saved={18400} target={30000} />
        <Goal hue="peach" glyph="hexagon" name="Notebook novo" saved={3100} target={6500} />
        <Goal hue="butter" glyph="diamond" name="Curso de cerâmica" saved={900} target={1200} />
      </Box>
    </Slide>

    {/* 4 · Três passos: cartões pastel numerados e o botão escuro. */}
    <Slide {...page} padding={`36 ${space.page}`} gap={18} justifyContent="center">
      <Blob hue="mint" left={-60} top={250} size={220} />
      <Text fontSize={34} fontWeight="bold" letterSpacing={-1.2} textAlign="center">Comece em três passos</Text>
      <Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={space.gap}>
        {(
          [
            ['lilac', '1', 'Conecte seus bancos', 'Open Finance, leitura só: a Brisa nunca move dinheiro.'],
            ['mint', '2', 'Escolha uma meta', 'Viagem, reserva ou o que for. A gente calcula o ritmo.'],
            ['peach', '3', 'Receba o resumo', 'Toda segunda, um parágrafo e três números. Só.'],
          ] as const
        ).map(([hue, n, title, text]) => (
          <Card hue={hue}>
            <Box width={34} height={34} borderRadius={17} backgroundColor={color.card} justifyContent="center" alignItems="center">
              <Text fontSize={15} fontWeight="bold" color={color.ink}>{n}</Text>
            </Box>
            <Text fontSize={font.h2} fontWeight="bold" marginTop={8}>{title}</Text>
            <Text fontSize={11} color={color.ink} lineHeight={1.4} opacity={0.75}>{text}</Text>
          </Card>
        ))}
      </Box>
      <Box alignSelf="center" display="flex" alignItems="center" gap={10} backgroundColor={color.ink} borderRadius={22} padding="11 22" marginTop={4}>
        <Text fontSize={13} fontWeight="bold" color={color.card}>Baixar a Brisa</Text>
        <Shape kind="arrowRight" width={14} height={10} backgroundColor={color.mint} />
      </Box>
    </Slide>
  </Deck>
));
