import { B, Box, Deck, I, Shape, Slide, Span, Table, Text, defineDeck } from 'pptsx';

// Galeria · Programa de um festival de curtas (fictício) em Olinda: Mostra Lanterna, 9ª edição.
//
// Paleta: uma sala escura com um projetor aceso.
//   ameixa   #2A0E2F — a sala; fundo das páginas de abertura e tinta das páginas claras
//   lanterna #FFC23C — a luz do projetor; só no título e no que é "agora"
//   rosa     #FF5D8F — a mostra competitiva e os acentos de texto
//   papel    #FCE8EE — o programa impresso, rosado e não creme
//   lilás    #B79BC0 — texto secundário sobre a ameixa; #8A6B8F sobre o papel
// Tipografia: só Arial, em dois registros. Caixa alta com letterSpacing largo para o que é
// marquise (título, dias, horários) e caixa baixa normal para sinopse e créditos.
// Assinatura: a película. Fileiras de furos de tração (Box com borderRadius em flex row) correm
// no topo e na base de todo slide, e o halo do projetor (elipses com opacity, zIndex -1) fica atrás.

const C = {
  ameixa: '#2A0E2F',
  ameixaClara: '#43204A',
  lanterna: '#FFC23C',
  rosa: '#FF5D8F',
  papel: '#FCE8EE',
  lilas: '#B79BC0',
  lilasEscuro: '#8A6B8F',
  branco: '#FFFFFF',
} as const;

/** Uma fileira de furos de película; `edge` decide se encosta no topo ou na base do slide. */
const Sprockets = ({ edge, color }: { edge: 'top' | 'bottom'; color: string }) => (
  <Box
    position="absolute" left={0} width="100%" height={10} zIndex={-1}
    top={edge === 'top' ? 10 : undefined} bottom={edge === 'bottom' ? 10 : undefined}
    display="flex" justifyContent="space-between" padding="0 14"
  >
    {Array.from({ length: 28 }, () => (
      <Box width={13} height={10} borderRadius={2.5} backgroundColor={color} />
    ))}
  </Box>
);

const Film = ({ color }: { color: string }) => (
  <>
    <Sprockets edge="top" color={color} />
    <Sprockets edge="bottom" color={color} />
  </>
);

/** O halo do projetor: três elipses concêntricas, a menor mais opaca. */
const Halo = ({ right, top, size }: { right: number; top: number; size: number }) => (
  <>
    {[1, 0.66, 0.36].map((k, i) => (
      <Shape
        kind="ellipse" position="absolute" zIndex={-1}
        right={right + (size * (1 - k)) / 2} top={top + (size * (1 - k)) / 2}
        width={size * k} height={size * k}
        backgroundColor={C.lanterna} opacity={[0.07, 0.1, 0.16][i]!}
      />
    ))}
  </>
);

const Marquee = ({ children, color = C.lilasEscuro }: { children: string; color?: string }) => (
  <Text fontSize={10} fontWeight="bold" letterSpacing={3} textTransform="uppercase" color={color}>
    {children}
  </Text>
);

const MOSTRAS = [
  { name: 'Competitiva Pernambuco', n: 14, lead: true },
  { name: 'Competitiva Nacional', n: 12, lead: true },
  { name: 'Animação', n: 8, lead: false },
  { name: 'Infantil', n: 6, lead: false },
  { name: 'Corpo e território', n: 5, lead: false },
  { name: 'Sessão acessível', n: 3, lead: false },
] as const;

type Session = { title: string; credit: string; kind: 'comp' | 'anim' | 'inf' | 'acess' };
const DAYS = ['qui 12', 'sex 13', 'sáb 14', 'dom 15', 'seg 16'] as const;
const TIMES = ['15h', '18h', '20h30'] as const;
// Uma sessão por dia e horário, na ordem das linhas (15h, 18h, 20h30).
const PROGRAM: readonly (readonly Session[])[] = [
  [
    { title: 'Bicho de Pé', credit: '6 curtas · 52 min', kind: 'inf' },
    { title: 'Desenho Animado', credit: '7 curtas · 61 min', kind: 'anim' },
    { title: 'Maré de Março', credit: 'abertura · 24 min', kind: 'comp' },
  ],
  [
    { title: 'Com Libras e AD', credit: '3 curtas · 44 min', kind: 'acess' },
    { title: 'Corpo e Território', credit: '5 curtas · 70 min', kind: 'comp' },
    { title: 'Pernambuco 1', credit: '5 curtas · 78 min', kind: 'comp' },
  ],
  [
    { title: 'Bicho de Pé 2', credit: 'reprise · 52 min', kind: 'inf' },
    { title: 'Nacional 1', credit: '6 curtas · 81 min', kind: 'comp' },
    { title: 'Pernambuco 2', credit: '5 curtas · 74 min', kind: 'comp' },
  ],
  [
    { title: 'Massa de Modelar', credit: 'oficina · 90 min', kind: 'anim' },
    { title: 'Nacional 2', credit: '6 curtas · 77 min', kind: 'comp' },
    { title: 'Pernambuco 3', credit: '4 curtas · 69 min', kind: 'comp' },
  ],
  [
    { title: 'Com Libras e AD', credit: 'reprise · 44 min', kind: 'acess' },
    { title: 'Júri popular', credit: 'votação · 60 min', kind: 'anim' },
    { title: 'Encerramento', credit: 'prêmios · 40 min', kind: 'comp' },
  ],
];
const KIND_COLOR: Readonly<Record<Session['kind'], string>> = {
  comp: C.rosa,
  anim: C.lanterna,
  inf: '#7FC8A9',
  acess: '#7FA8FF',
};

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: película no topo e na base, halo atrás, título com letterSpacing largo e um selo girado. */}
    <Slide backgroundColor={C.ameixa} color={C.branco} padding={{ base: '44 48', tall: '60 48' }} justifyContent="center">
      <Film color={C.ameixaClara} />
      <Halo right={-120} top={-20} size={420} />
      <Text
        position="absolute" right={-62} top={{ base: 195, tall: 263 }} rotate={-90}
        width={160} textAlign="center" nowrap
        fontSize={9} fontWeight="bold" letterSpacing={4} color={C.lilas}
      >
        9ª EDIÇÃO · 2026
      </Text>
      <Marquee color={C.rosa}>9ª mostra de curtas de Olinda</Marquee>
      <Text fontSize={{ base: 86, tall: 92 }} fontWeight="bold" letterSpacing={{ base: 9, tall: 10 }} color={C.lanterna} lineHeight={1} marginTop={10}>
        LANTERNA
      </Text>
      <Text fontSize={{ base: 24, tall: 28 }} fontWeight="bold" marginTop={{ base: 14, tall: 20 }}>
        12 a 16 de novembro
      </Text>
      <Text fontSize={{ base: 14, tall: 16 }} color={C.lilas} marginTop={6}>
        48 curtas, 5 noites, entrada gratuita no Cine Ladeira e no Mercado Eufrásio Barbosa.
      </Text>
    </Slide>

    {/* 2 · Mostras: número grande à esquerda e pílulas que quebram em linhas (flexWrap). */}
    <Slide backgroundColor={C.papel} color={C.ameixa} padding={{ base: '48 48', tall: '64 48' }} gap={{ base: 20, tall: 28 }}>
      <Film color="#F4CFDA" />
      <Marquee>Seis mostras</Marquee>
      <Box display="flex" gap={{ base: 32, tall: 36 }} alignItems="center" flex={1}>
        <Box width={{ base: 190, tall: 200 }} flexShrink={0}>
          <Text fontSize={{ base: 128, tall: 150 }} fontWeight="bold" letterSpacing={-2} lineHeight={1} nowrap>
            48
          </Text>
          <Text fontSize={{ base: 16, tall: 18 }} fontWeight="bold" lineHeight={1.25} marginTop={6}>
            curtas escolhidos entre <Span color={C.rosa}>1.312 inscritos</Span> de 23 estados.
          </Text>
        </Box>
        <Box flex={1} gap={{ base: 14, tall: 20 }}>
          <Box display="flex" flexWrap="wrap" gap={{ base: 8, tall: 10 }}>
            {MOSTRAS.map((m) => (
              <Text
                fontSize={{ base: 14, tall: 16 }} padding="7 14" borderRadius={20}
                backgroundColor={m.lead ? C.ameixa : C.branco}
                color={m.lead ? C.lanterna : C.ameixa}
                fontWeight={m.lead ? 'bold' : 'normal'}
              >
                {`${m.name} · ${m.n}`}
              </Text>
            ))}
          </Box>
          <Text fontSize={{ base: 13, tall: 15 }} lineHeight={1.35} color={C.lilasEscuro}>
            As duas competitivas (em ameixa) disputam o Troféu Lanterna e R$ 60 mil em prêmios; as outras quatro são
            mostras paralelas, sem júri.
          </Text>
        </Box>
      </Box>
    </Slide>

    {/* 3 · Grade de sessões: 6 colunas de grid (horário + 5 dias); a borda esquerda diz a mostra. */}
    <Slide backgroundColor={C.papel} color={C.ameixa} padding={{ base: '40 40', tall: '52 40' }} gap={{ base: 12, tall: 18 }}>
      <Film color="#F4CFDA" />
      <Box display="flex" justifyContent="space-between" alignItems="baseline">
        <Text fontSize={{ base: 24, tall: 28 }} fontWeight="bold">
          Programa
        </Text>
        <Box display="flex" gap={12}>
          {(
            [
              ['competitiva', KIND_COLOR.comp],
              ['animação', KIND_COLOR.anim],
              ['infantil', KIND_COLOR.inf],
              ['acessível', KIND_COLOR.acess],
            ] as const
          ).map(([label, color]) => (
            <Text fontSize={9} paddingLeft={6} borderLeft={`4px solid ${color}`} color={C.lilasEscuro}>
              {label}
            </Text>
          ))}
        </Box>
      </Box>
      <Box
        display="grid" flex={1} gap={6}
        gridTemplateColumns="44pt repeat(5, minmax(0, 1fr))"
        gridTemplateRows="auto"
        gridAutoRows="minmax(0, 1fr)"
      >
        <Box />
        {DAYS.map((d) => {
          const [weekday, day] = d.split(' ');
          return (
            <Box display="flex" alignItems="baseline" gap={6} paddingBottom={4} borderBottom={`2px solid ${C.ameixa}`}>
              <Text fontSize={{ base: 30, tall: 36 }} fontWeight="bold" letterSpacing={-1} nowrap>
                {day!}
              </Text>
              <Text fontSize={9} fontWeight="bold" letterSpacing={2} textTransform="uppercase" color={C.lilasEscuro}>
                {weekday!}
              </Text>
            </Box>
          );
        })}
        {TIMES.flatMap((time, row) => [
          <Text fontSize={10} fontWeight="bold" letterSpacing={1} color={C.lilasEscuro} paddingTop={6}>
            {time}
          </Text>,
          ...PROGRAM.map((day, col) => {
            const s = day[row]!;
            const opening = col === 0 && row === 2;
            return (
              <Box
                backgroundColor={opening ? C.ameixa : C.branco}
                borderLeft={`4px solid ${KIND_COLOR[s.kind]}`}
                padding="6 8" gap={2}
              >
                <Text fontSize={{ base: 11, tall: 13 }} fontWeight="bold" color={opening ? C.lanterna : C.ameixa}>
                  {s.title}
                </Text>
                <Text fontSize={{ base: 9, tall: 10 }} color={opening ? C.lilas : C.lilasEscuro}>
                  {s.credit}
                </Text>
              </Box>
            );
          }),
        ])}
      </Box>
      <Text fontSize={9} color={C.lilasEscuro}>
        15h e 18h no Mercado Eufrásio Barbosa · 20h30 no Cine Ladeira · senhas uma hora antes, na bilheteria
      </Text>
    </Slide>

    {/* 4 · Filme de abertura: citação com rich text (I, Span, B) e o halo de novo atrás. */}
    <Slide backgroundColor={C.ameixa} color={C.branco} padding={{ base: '52 56', tall: '72 56' }} justifyContent="center" gap={{ base: 18, tall: 26 }}>
      <Film color={C.ameixaClara} />
      <Halo right={-160} top={-60} size={460} />
      <Text position="absolute" left={36} top={{ base: 18, tall: 40 }} fontSize={180} fontWeight="bold" color={C.rosa} opacity={0.35} zIndex={-1}>
        “
      </Text>
      <Marquee color={C.lanterna}>Abertura · qui 12 · 20h30</Marquee>
      <Text fontSize={{ base: 26, tall: 30 }} lineHeight={1.25} width="88%">
        Filmei a maré de março porque é a única vez no ano em que o rio <I>volta</I> para dentro da cidade e{' '}
        <Span color={C.lanterna} fontWeight="bold">
          ninguém acha estranho
        </Span>
        .
      </Text>
      <Box display="flex" gap={14} alignItems="center">
        <Box width={36} height={3} backgroundColor={C.rosa} />
        <Text fontSize={{ base: 13, tall: 15 }} color={C.lilas}>
          <B>Joana Arcoverde</B>, diretora de <I>Maré de Março</I> (PE, 24 min, estreia mundial)
        </Text>
      </Box>
    </Slide>

    {/* 5 · Lugares: tabela nativa com zebra; pílula de aviso no rodapé. */}
    <Slide backgroundColor={C.papel} color={C.ameixa} padding={{ base: '48 48', tall: '64 48' }} gap={{ base: 18, tall: 26 }}>
      <Film color="#F4CFDA" />
      <Marquee>Onde e como entrar</Marquee>
      <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold">
        Três lugares, nenhum ingresso pago
      </Text>
      <Table
        fontSize={{ base: 13, tall: 15 }} cellPadding={{ base: 8, tall: 11 }}
        header={{ fill: C.ameixa, color: C.lanterna }}
        stripe={C.branco} border="#EBC3D0"
        columns={[
          { header: 'Sala', width: '28%' },
          { header: 'Endereço' },
          { header: 'Lugares', align: 'right' },
          { header: 'Sessões', align: 'right' },
        ]}
        rows={[
          ['Cine Ladeira', 'Rua do Amparo, 41', '212', '20h30'],
          ['Mercado Eufrásio', 'Av. Joaquim Nabuco, s/n', '140', '15h e 18h'],
          ['Praça do Carmo', 'telão ao ar livre', '600', 'sáb 14, 22h'],
        ]}
      />
      <Box display="flex" gap={10} flexWrap="wrap" marginTop="auto">
        {['Senha 1 h antes, uma por pessoa', 'Libras e audiodescrição: sex 13 e seg 16', 'Rampa nos três lugares'].map(
          (t) => (
            <Text fontSize={{ base: 11, tall: 13 }} padding="6 12" borderRadius={14} border={`1.5px solid ${C.ameixa}`}>
              {t}
            </Text>
          ),
        )}
      </Box>
    </Slide>
  </Deck>
));
