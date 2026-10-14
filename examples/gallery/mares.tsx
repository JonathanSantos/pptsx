import { B, Box, Chart, Deck, I, Shape, Slide, Span, Text, defineDeck } from 'pptsx';

// Galeria · Aula de ciências para o 9º ano: por que o mar sobe duas vezes por dia.
//
// Paleta: o mar à noite, com a Lua e o Sol como as únicas luzes.
//   abissal #0D2B3E — fundo dos slides de diagrama e tinta dos slides claros
//   mar     #2BB3B1 — a água; tudo o que é maré
//   terra   #2C6E9B — o planeta, um azul mais fechado que o mar
//   lua     #E3E7EE — a Lua e o texto sobre o fundo escuro
//   sol     #F5B83D — o Sol, que só entra no último slide
//   espuma  #EEF6F6 — fundo dos slides de texto; muted #5D7A86
// Tipografia: só Arial, como livro didático: corpo grande (16–20 pt) com entrelinha aberta,
// rótulos de figura em 10–11 pt com uma barra fina à esquerda, como legenda de atlas.
// Assinatura: o diagrama Terra–Lua montado só com Shape e Box: o "envelope" de água é uma
// elipse translúcida (opacity) mais larga que a Terra, e as setas de força são Box + "►".

const C = {
  abissal: '#0D2B3E',
  abissalClaro: '#16405A',
  mar: '#2BB3B1',
  terra: '#2C6E9B',
  lua: '#E3E7EE',
  sol: '#F5B83D',
  espuma: '#EEF6F6',
  muted: '#5D7A86',
  mutedEscuro: '#9DB6C2',
  branco: '#FFFFFF',
} as const;

/** Seta horizontal: haste de Box e ponta de texto. O comprimento é a informação. */
const Arrow = ({ length, color }: { length: number; color: string }) => (
  <Box display="flex" alignItems="center" flexShrink={0}>
    <Box width={length} height={3} backgroundColor={color} />
    <Text fontSize={11} color={color} marginLeft={-3} lineHeight={1}>
      ►
    </Text>
  </Box>
);

/** Rótulo de figura: barra fina à esquerda, texto pequeno. */
const Caption = ({ children, color = C.muted, bar = C.mar }: { children: string; color?: string; bar?: string }) => (
  <Text fontSize={10} color={color} paddingLeft={8} borderLeft={`1.5px solid ${bar}`} lineHeight={1.3}>
    {children}
  </Text>
);

/** Terra dentro do envelope de água. Coordenadas absolutas dentro de uma caixa de tamanho fixo. */
const EarthWithTide = ({ cx, cy, r, stretch = 1.6, vertical = false, angle = 0 }: { cx: number; cy: number; r: number; stretch?: number; vertical?: boolean; angle?: number }) => {
  const w = vertical ? r * 2.3 : r * 2 * stretch;
  const h = vertical ? r * 2 * stretch : r * 2.3;
  return (
    <>
      <Shape kind="ellipse" position="absolute" left={cx - w / 2} top={cy - h / 2} width={w} height={h} backgroundColor={C.mar} opacity={0.45} rotate={angle} />
      <Shape kind="ellipse" position="absolute" left={cx - r} top={cy - r} width={r * 2} height={r * 2} backgroundColor={C.terra} />
    </>
  );
};

const Moon = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <Shape kind="ellipse" position="absolute" left={cx - r} top={cy - r} width={r * 2} height={r * 2} backgroundColor={C.lua} />
);

const Point = ({ x, y, label }: { x: number; y: number; label: string }) => (
  <>
    <Shape kind="ellipse" position="absolute" left={x - 4} top={y - 4} width={8} height={8} backgroundColor={C.sol} />
    <Text position="absolute" left={x - 10} top={y + 6} width={20} textAlign="center" fontSize={11} fontWeight="bold" color={C.branco}>
      {label}
    </Text>
  </>
);

const STEPS = [
  { title: 'A Lua puxa', body: 'A gravidade da Lua atua na Terra inteira, mas é mais forte no lado virado para ela.' },
  { title: 'A água se estica', body: 'O oceano forma duas “barrigas”: uma de frente para a Lua e outra do lado oposto.' },
  { title: 'A Terra gira', body: 'Em um dia, cada praia passa por baixo das duas barrigas e de dois vales entre elas.' },
  { title: 'Duas marés altas', body: 'Duas preamares e duas baixa-mares a cada 24 h 50 min, porque a Lua também anda.' },
] as const;

const HOURS = ['0h', '2h', '4h', '6h', '8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'];
const TIDE = [0.81, 1.37, 1.46, 0.99, 0.43, 0.29, 0.71, 1.26, 1.43, 1.03, 0.43, 0.19, 0.55];

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: a Terra com o envelope de água sai pela borda; a órbita é um círculo tracejado. */}
    <Slide backgroundColor={C.abissal} color={C.lua} padding={{ base: 48, tall: 56 }} justifyContent="flex-end">
      <Box
        position="absolute" zIndex={-1} right={-260} top={{ base: -150, tall: -110 }} width={640} height={640}
        borderRadius={320} border={`1.5px dashed ${C.abissalClaro}`}
      />
      <Box position="absolute" zIndex={-1} right={0} top={0} width={340} height={{ base: 405, tall: 540 }}>
        <EarthWithTide cx={250} cy={260} r={110} stretch={1.45} angle={46} />
        <Moon cx={60} cy={60} r={22} />
      </Box>
      <Text fontSize={10} fontWeight="bold" letterSpacing={2} textTransform="uppercase" color={C.mar}>
        Ciências · 9º ano · aula 14
      </Text>
      <Text fontSize={{ base: 40, tall: 46 }} fontWeight="bold" color={C.branco} lineHeight={1.08} width="62%" marginTop={10}>
        Por que o mar sobe duas vezes por dia
      </Text>
      <Text fontSize={{ base: 16, tall: 18 }} color={C.mutedEscuro} width="56%" marginTop={12} lineHeight={1.35}>
        A Lua não “puxa a água para cima”. Ela estica a Terra inteira, e o oceano é a parte que consegue escorrer.
      </Text>
    </Slide>

    {/* 2 · O diagrama: figura de tamanho fixo + texto; em 4:3 a figura vai para cima. */}
    <Slide backgroundColor={C.abissal} color={C.lua} padding={{ base: 40, tall: 44 }} gap={14}>
      <Text fontSize={{ base: 26, tall: 28 }} fontWeight="bold" color={C.branco}>
        O lado de perto é puxado mais forte
      </Text>
      <Box
        display="grid" flex={1} gap={{ base: 28, tall: 8 }}
        gridTemplateColumns={{ base: '340pt minmax(0, 1fr)', tall: 'minmax(0, 1fr)' }}
        gridTemplateRows={{ base: 'minmax(0, 1fr)', tall: 'auto minmax(0, 1fr)' }}
      >
        <Box width={340} height={210} alignSelf="center" justifySelf="center">
          <EarthWithTide cx={110} cy={105} r={62} stretch={1.55} />
          <Moon cx={318} cy={105} r={18} />
          <Point x={172} y={105} label="A" />
          <Point x={110} y={105} label="B" />
          <Point x={48} y={105} label="C" />
          <Box position="absolute" left={8} top={186} width={330}>
            <Caption color={C.mutedEscuro}>Fora de escala: a Lua fica a 30 Terras de distância.</Caption>
          </Box>
        </Box>
        <Box gap={12} justifyContent="center">
          <Text fontSize={{ base: 14, tall: 15 }} lineHeight={1.4}>
            A gravidade enfraquece com a distância. O ponto <B>A</B> está mais perto da Lua que o centro <B>B</B>, e o
            ponto <B>C</B> está mais longe que os dois.
          </Text>
          <Box gap={{ base: 8, tall: 6 }} padding="10 14" backgroundColor={C.abissalClaro} borderRadius={10}>
            {(
              [
                ['A · de frente para a Lua', 96],
                ['B · centro da Terra', 62],
                ['C · do lado oposto', 34],
              ] as const
            ).map(([label, len]) => (
              <Box display="flex" alignItems="center" gap={10}>
                <Text fontSize={11} width={124} flexShrink={0} color={C.lua}>
                  {label}
                </Text>
                <Arrow length={len} color={C.sol} />
              </Box>
            ))}
          </Box>
          <Text fontSize={{ base: 14, tall: 15 }} lineHeight={1.4}>
            Em A a água escorre na direção da Lua; em C ela <Span color={C.mar} fontWeight="bold">fica para trás</Span>.
            Por isso há duas marés altas, uma de cada lado.
          </Text>
        </Box>
      </Box>
    </Slide>

    {/* 3 · Passos numerados (aqui a ordem importa); o número é um fundo translúcido atrás do título. */}
    <Slide backgroundColor={C.espuma} color={C.abissal} padding={{ base: 40, tall: 48 }} gap={{ base: 18, tall: 24 }}>
      <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold">
        Em quatro passos
      </Text>
      <Box
        display="grid" flex={1} gap={14}
        gridTemplateColumns="repeat(4, minmax(0, 1fr))"
        gridAutoRows="minmax(0, 1fr)"
      >
        {STEPS.map((s, i) => (
          <Box backgroundColor={C.branco} borderRadius={12} padding={16} gap={{ base: 8, tall: 6 }} boxShadow="0 2px 8px rgba(13,43,62,0.10)">
            <Text
              position="absolute" right={12} bottom={-8}
              fontSize={{ base: 88, tall: 96 }} fontWeight="bold" color={C.mar} opacity={0.16}
            >
              {String(i + 1)}
            </Text>
            <Text fontSize={10} fontWeight="bold" letterSpacing={2} color={C.mar}>
              {`PASSO ${i + 1}`}
            </Text>
            <Text fontSize={{ base: 17, tall: 18 }} fontWeight="bold">
              {s.title}
            </Text>
            <Text fontSize={{ base: 12, tall: 13 }} color={C.muted} lineHeight={1.4}>
              {s.body}
            </Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={{ base: 13, tall: 15 }} lineHeight={1.35} padding="10 14" backgroundColor={C.branco} borderLeft={`4px solid ${C.mar}`}>
        Por que 24 h 50 min e não 24 h? Enquanto a Terra dá uma volta, a Lua avança <B>13°</B> na órbita, e a praia precisa
        girar mais um pouco para alcançá-la.
      </Text>
    </Slide>

    {/* 4 · Dado real: gráfico de linha nativo e dois rótulos de preamar. */}
    <Slide backgroundColor={C.espuma} color={C.abissal} padding={{ base: 40, tall: 48 }} gap={{ base: 14, tall: 20 }}>
      <Box display="flex" justifyContent="space-between" alignItems="baseline" gap={20}>
        <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold">
          Um dia de maré em Santos
        </Text>
        <Text fontSize={10} color={C.muted} nowrap>
          altura em metros, 14 de outubro
        </Text>
      </Box>
      <Box
        display="grid" flex={1} gap={16}
        gridTemplateColumns={{ base: 'minmax(0, 1fr) 170pt', tall: 'minmax(0, 1fr)' }}
        gridTemplateRows={{ base: 'minmax(0, 1fr)', tall: 'minmax(0, 1fr) auto' }}
      >
        <Box backgroundColor={C.branco} borderRadius={12} padding={12}>
          <Chart kind="line" flex={1} size={9} color={C.abissal} colors={[C.mar]} data={{ categories: HOURS, series: [{ name: 'Maré', values: TIDE }] }} />
        </Box>
        <Box gap={10} justifyContent="center" flexDirection={{ base: 'column', tall: 'row' }}>
          {(
            [
              ['Preamar', '03h40', '1,47 m'],
              ['Preamar', '16h05', '1,44 m'],
              ['Baixa-mar', '22h20', '0,18 m'],
            ] as const
          ).map(([kind, time, height]) => (
            <Box flexGrow={{ base: 0, tall: 1 }} flexBasis={{ base: 'auto', tall: 0 }} padding="10 12" backgroundColor={C.branco} borderLeft={`4px solid ${kind === 'Preamar' ? C.mar : C.muted}`}>
              <Text fontSize={9} fontWeight="bold" letterSpacing={1.5} textTransform="uppercase" color={C.muted}>
                {kind}
              </Text>
              <Box display="flex" alignItems="baseline" gap={8}>
                <Text fontSize={22} fontWeight="bold" nowrap>
                  {time}
                </Text>
                <Text fontSize={12} color={C.muted} nowrap>
                  {height}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      <Text fontSize={{ base: 12, tall: 14 }} color={C.muted}>
        As duas preamares estão a <I>12 h 25 min</I> uma da outra: metade de um dia lunar.
      </Text>
    </Slide>

    {/* 5 · Sizígia × quadratura: duas figuras que são o mesmo componente com a Lua em outro lugar. */}
    <Slide backgroundColor={C.abissal} color={C.lua} padding={{ base: 40, tall: 48 }} gap={{ base: 14, tall: 20 }}>
      <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold" color={C.branco}>
        O Sol também puxa, com metade da força
      </Text>
      <Box display="grid" flex={1} gap={16} gridTemplateColumns="repeat(2, minmax(0, 1fr))" gridTemplateRows="minmax(0, 1fr)">
        {(
          [
            {
              name: 'Sizígia',
              when: 'lua nova e lua cheia',
              text: 'Sol, Terra e Lua em linha: os puxões somam. Em Santos, até 2,1 m de maré.',
              moon: { cx: 236, cy: 90 },
              vertical: false,
            },
            {
              name: 'Quadratura',
              when: 'quarto crescente e minguante',
              text: 'A Lua a 90° do Sol: um puxão atrapalha o outro. Só uns 0,9 m de maré.',
              moon: { cx: 150, cy: 18 },
              vertical: true,
            },
          ] as const
        ).map((p) => (
          <Box backgroundColor={C.abissalClaro} borderRadius={14} padding={14} gap={8}>
            <Box width={260} height={180} alignSelf="center" margin="auto 0">
              <Shape kind="ellipse" position="absolute" left={0} top={62} width={56} height={56} backgroundColor={C.sol} />
              <EarthWithTide cx={150} cy={90} r={34} stretch={p.vertical ? 1.3 : 1.7} vertical={p.vertical} />
              <Moon cx={p.moon.cx} cy={p.moon.cy} r={11} />
            </Box>
            <Box display="flex" alignItems="baseline" gap={8} flexWrap="wrap">
              <Text fontSize={{ base: 17, tall: 20 }} fontWeight="bold" color={C.branco}>
                {p.name}
              </Text>
              <Text fontSize={10} color={C.mar} fontWeight="bold">
                {p.when}
              </Text>
            </Box>
            <Text fontSize={{ base: 12, tall: 14 }} lineHeight={1.4} color={C.mutedEscuro}>
              {p.text}
            </Text>
          </Box>
        ))}
      </Box>
    </Slide>
  </Deck>
));
