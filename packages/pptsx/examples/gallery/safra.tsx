import { B, Box, Chart, Deck, Slide, Table, Text, defineDeck } from 'pptsx';

// Galeria · Relatório anual de uma cooperativa agrícola (fictícia) do norte do Paraná.
//
// Paleta: vem do chão e da lavoura, não de um "tema corporativo".
//   terra roxa #4A1F24 — o solo da região; fundo da capa e cor da tinta forte
//   soja      #5E8C31 — a cultura principal; o verde que mede "mais"
//   milho     #E8A317 — o destaque, usado com parcimônia (rótulos e um alerta)
//   névoa     #EEF1EA — superfície fria e esverdeada, para não cair no creme
//   tinta     #2E1A1C — texto; muted #7A6A66
// Tipografia: só Arial. A voz vem do contraste de escala (números de 40–64 pt contra rótulos
// de 10–11 pt em caixa alta com letterSpacing) e de unidades pequenas alinhadas pela baseline.
// Assinatura: o mosaico de talhões visto de cima. A capa é um grid girado de lotes coloridos
// (zIndex atrás do título) e o mesmo vocabulário volta no mapa de calor de chuva, célula a célula.

const C = {
  terra: '#4A1F24',
  terraClara: '#6B3238',
  soja: '#5E8C31',
  milho: '#E8A317',
  nevoa: '#EEF1EA',
  tinta: '#2E1A1C',
  muted: '#7A6A66',
  linha: '#D6DBCF',
  branco: '#FFFFFF',
} as const;

// Escala sequencial da chuva (mm/mês): da palha seca ao verde fechado.
const RAIN = [
  { max: 60, bg: '#EFEBD8', fg: C.tinta },
  { max: 100, bg: '#D5E2B0', fg: C.tinta },
  { max: 140, bg: '#A9C97A', fg: C.tinta },
  { max: 180, bg: '#6FA34A', fg: C.branco },
  { max: Infinity, bg: '#3D6F2A', fg: C.branco },
] as const;
const rainColor = (mm: number) => RAIN.find((b) => mm < b.max) ?? RAIN[RAIN.length - 1]!;

const MONTHS = ['jul', 'ago', 'set', 'out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun'];
const RAINFALL: readonly (readonly [string, readonly number[]])[] = [
  ['Cedro', [42, 31, 88, 152, 171, 196, 214, 168, 131, 92, 104, 63]],
  ['Arapuã', [38, 27, 74, 139, 158, 38, 187, 175, 122, 86, 97, 55]],
  ['Lajeado', [45, 36, 95, 161, 166, 204, 221, 177, 138, 99, 111, 66]],
  ['Pinhal', [51, 40, 97, 148, 183, 199, 208, 159, 127, 94, 108, 71]],
  ['Ivaí', [39, 29, 81, 144, 162, 188, 201, 163, 119, 83, 95, 58]],
];

// Lotes do mosaico da capa: cor e quantas colunas ocupam (como talhões de largura diferente).
const PLOTS: readonly (readonly [string, number])[] = [
  ['#5E8C31', 2], ['#E8A317', 1], ['#3D6F2A', 1],
  ['#A9C97A', 1], ['#6B3238', 1], ['#5E8C31', 1], ['#D5E2B0', 1],
  ['#3D6F2A', 1], ['#C98B12', 2], ['#6FA34A', 1],
  ['#E8A317', 1], ['#5E8C31', 1], ['#A9C97A', 2],
  ['#6B3238', 2], ['#6FA34A', 1], ['#E8A317', 1],
  ['#A9C97A', 1], ['#3D6F2A', 1], ['#5E8C31', 1], ['#D5E2B0', 1],
  ['#6FA34A', 1], ['#E8A317', 2], ['#3D6F2A', 1],
];

const Eyebrow = ({ children, color = C.muted }: { children: string; color?: string }) => (
  <Text fontSize={10} fontWeight="bold" letterSpacing={2.5} textTransform="uppercase" color={color}>
    {children}
  </Text>
);

const Head = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <Box gap={4}>
    <Eyebrow>{eyebrow}</Eyebrow>
    <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold">
      {title}
    </Text>
  </Box>
);

const Folio = ({ n }: { n: string }) => (
  <Box display="flex" justifyContent="space-between" marginTop="auto" paddingTop={8} borderTop={`1px solid ${C.linha}`}>
    <Text fontSize={9} color={C.muted}>
      Cooperativa Serra do Cedro · Relatório da safra 2025/26
    </Text>
    <Text fontSize={9} fontWeight="bold" color={C.muted}>
      {n}
    </Text>
  </Box>
);

const KPIS = [
  { label: 'Recebido', value: '412', unit: 'mil t de grão', delta: '+9% sobre 24/25', crop: C.milho },
  { label: 'Faturamento', value: '1,94', unit: 'R$ bilhões', delta: '+12% sobre 24/25', crop: C.terraClara },
  { label: 'Soja', value: '61,8', unit: 'sacas por hectare', delta: '+4,1 sc/ha', crop: C.soja },
  { label: 'Cooperados', value: '3.140', unit: 'famílias ativas', delta: '126 entraram', crop: '#A9C97A' },
] as const;

const SOBRAS = [
  { label: 'Conta capital', pct: 55, bg: C.soja },
  { label: 'Pago em dinheiro', pct: 25, bg: C.milho },
  { label: 'Fundo de reserva', pct: 10, bg: '#A9C97A' },
  { label: 'FATES', pct: 10, bg: '#D5E2B0' },
] as const;

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: o mosaico girado fica atrás (zIndex -1) e sangra para fora do slide. */}
    <Slide backgroundColor={C.terra} color={C.branco} padding={{ base: 44, tall: 52 }}>
      <Box
        position="absolute" zIndex={-1} rotate={-14}
        right={{ base: -70, tall: -90 }} top={{ base: -90, tall: -70 }}
        width={{ base: 400, tall: 430 }} height={{ base: 600, tall: 700 }}
        display="grid" gridTemplateColumns="repeat(4, minmax(0, 1fr))" gridAutoRows="minmax(0, 1fr)" gap={7}
      >
        {PLOTS.map(([bg, span]) => (
          <Box backgroundColor={bg} gridColumn={`span ${span}`} />
        ))}
      </Box>
      <Box width={{ base: '50%', tall: '56%' }} marginTop="auto" gap={10}>
        <Eyebrow color={C.milho}>Cooperativa Serra do Cedro</Eyebrow>
        <Text fontSize={{ base: 60, tall: 72 }} fontWeight="bold" lineHeight={1}>
          Safra 2025/26
        </Text>
        <Text fontSize={{ base: 18, tall: 21 }} color="#E9D9D3">
          Relatório anual aos cooperados: o que entrou no armazém, o que choveu e para onde vão as sobras.
        </Text>
      </Box>
      <Text fontSize={10} color="#C9A9A4" marginTop={{ base: 28, tall: 56 }}>
        Assembleia geral ordinária · Faxinal, 14 de novembro de 2026
      </Text>
    </Slide>

    {/* 2 · Quatro números: faixa por cultura (borderTop) e unidade pela baseline. */}
    <Slide backgroundColor={C.nevoa} color={C.tinta} padding={{ base: 40, tall: 48 }} gap={{ base: 22, tall: 28 }}>
      <Head eyebrow="O ano em quatro números" title="Mais grão no armazém, apesar da seca" />
      <Box
        display="grid" gap={14} flex={1}
        gridTemplateColumns="repeat(4, minmax(0, 1fr))"
        gridAutoRows="minmax(0, 1fr)"
      >
        {KPIS.map((k) => (
          <Box backgroundColor={C.branco} borderTop={`6px solid ${k.crop}`} padding={{ base: 16, tall: 18 }} justifyContent="center">
            <Eyebrow>{k.label}</Eyebrow>
            <Text fontSize={40} fontWeight="bold" nowrap marginTop={{ base: 6, tall: 14 }}>
              {k.value}
            </Text>
            <Text fontSize={{ base: 12, tall: 13 }} fontWeight="bold" color={C.muted}>
              {k.unit}
            </Text>
            <Text fontSize={{ base: 12, tall: 13 }} color={C.soja} fontWeight="bold" marginTop={10} paddingTop={8} borderTop={`1px solid ${C.linha}`}>
              {k.delta}
            </Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={{ base: 14, tall: 16 }} lineHeight={1.35} paddingLeft={14} borderLeft={`4px solid ${C.milho}`}>
        A estiagem de dezembro custou <B>7% da soja</B> no núcleo Arapuã; os outros quatro núcleos colheram acima da média e
        fecharam a conta.
      </Text>
      <Folio n="02" />
    </Slide>

    {/* 3 · Mapa de calor: 13 colunas de grid, uma célula colorida por mês e núcleo. */}
    <Slide backgroundColor={C.branco} color={C.tinta} padding={{ base: 40, tall: 48 }} gap={{ base: 16, tall: 22 }}>
      <Head eyebrow="Chuva por núcleo, mm por mês" title="Dezembro secou só em Arapuã" />
      <Box
        display="grid" columnGap={4} rowGap={4} flex={1}
        gridTemplateColumns="58pt repeat(12, minmax(0, 1fr))"
        gridTemplateRows="auto"
        gridAutoRows="minmax(0, 1fr)"
      >
        <Text />
        {MONTHS.map((m) => (
          <Text fontSize={9} fontWeight="bold" color={C.muted} textAlign="center" textTransform="uppercase" letterSpacing={1}>
            {m}
          </Text>
        ))}
        {RAINFALL.flatMap(([nucleo, values]) => [
          <Text fontSize={12} fontWeight="bold" alignSelf="center">
            {nucleo}
          </Text>,
          ...values.map((mm, i) => {
            // A célula da estiagem ganha borda: é o fato que o título conta.
            const drought = nucleo === 'Arapuã' && i === 5;
            const b = rainColor(mm);
            return (
              <Box
                justifyContent="center" backgroundColor={b.bg}
                border={drought ? `2.5px solid ${C.terra}` : '0px solid #FFFFFF'}
              >
                <Text fontSize={{ base: 11, tall: 13 }} fontWeight={drought ? 'bold' : 'normal'} textAlign="center" color={drought ? C.terra : b.fg}>
                  {mm}
                </Text>
              </Box>
            );
          }),
        ])}
      </Box>
      <Box display="flex" alignItems="center" gap={18} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={3}>
          {RAIN.map((b) => (
            <Box width={26} height={10} backgroundColor={b.bg} />
          ))}
        </Box>
        <Text fontSize={10} color={C.muted}>
          menos de 60 mm → mais de 180 mm
        </Text>
        <Text fontSize={10} color={C.terra} fontWeight="bold" paddingLeft={8} borderLeft={`2.5px solid ${C.terra}`}>
          38 mm em dezembro, contra 196 mm no Cedro
        </Text>
      </Box>
      <Text fontSize={13} color={C.muted} lineHeight={1.35} display={{ base: 'none', tall: 'flex' }}>
        Fonte: 31 pluviômetros dos campos de cooperados, médias por núcleo. A janela de plantio da soja vai de outubro a
        dezembro; uma falha de chuva nesse trecho pesa mais que qualquer outro mês.
      </Text>
      <Folio n="03" />
    </Slide>

    {/* 4 · Gráfico nativo e tabela lado a lado; em 4:3 (mesma largura, mais alto) as linhas da tabela respiram. */}
    <Slide backgroundColor={C.nevoa} color={C.tinta} padding={{ base: 40, tall: 48 }} gap={{ base: 18, tall: 24 }}>
      <Head eyebrow="Recebimento e produtividade" title="Soja puxou o volume; o milho, a margem" />
      <Box
        display="grid" gap={18} flex={1}
        gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
        gridTemplateRows="minmax(0, 1fr)"
      >
        <Box backgroundColor={C.branco} padding={12}>
          <Chart
            kind="bar" flex={1} legend size={10} color={C.tinta}
            title="Recebido por cultura (mil t)"
            colors={['#C9BFB0', C.soja]}
            data={{
              categories: ['Soja', 'Milho safrinha', 'Trigo', 'Café'],
              series: [
                { name: '24/25', values: [214, 118, 31, 15] },
                { name: '25/26', values: [226, 139, 33, 14] },
              ],
            }}
          />
        </Box>
        <Table
          alignSelf="flex-start"
          fontSize={{ base: 12, tall: 13 }} cellPadding={{ base: 6, tall: 11 }}
          header={{ fill: C.terra, color: C.branco }}
          stripe={C.branco} border={C.linha}
          columns={[
            { header: 'Núcleo' },
            { header: 'Cooperados', align: 'right' },
            { header: 'sc/ha', align: 'right' },
            { header: 'Δ', align: 'right' },
          ]}
          rows={[
            ['Cedro', '812', '64,2', '+5,0'],
            ['Arapuã', '538', '54,9', '−3,8'],
            ['Lajeado', '701', '63,7', '+6,2'],
            ['Pinhal', '629', '62,8', '+4,9'],
            ['Ivaí', '460', '61,1', '+3,6'],
          ]}
        />
      </Box>
      <Folio n="04" />
    </Slide>

    {/* 5 · Sobras: uma barra proporcional feita de Box com flex = percentual. */}
    <Slide backgroundColor={C.terra} color={C.branco} padding={{ base: 44, tall: 52 }} gap={{ base: 20, tall: 28 }}>
      <Eyebrow color={C.milho}>Destinação das sobras</Eyebrow>
      <Box display="flex" alignItems="baseline" gap={14} flexWrap="wrap">
        <Text fontSize={{ base: 64, tall: 80 }} fontWeight="bold" lineHeight={1} nowrap>
          R$ 148 mi
        </Text>
        <Text fontSize={{ base: 20, tall: 22 }} color="#E9D9D3">
          voltam para quem entregou a safra.
        </Text>
      </Box>
      <Box gap={8} marginTop={{ base: 8, tall: 24 }}>
        <Box display="flex" height={{ base: 46, tall: 64 }} gap={3}>
          {SOBRAS.map((s) => (
            <Box flex={s.pct} backgroundColor={s.bg} justifyContent="center" paddingLeft={10}>
              <Text fontSize={{ base: 15, tall: 18 }} fontWeight="bold" color={C.terra}>
                {`${s.pct}%`}
              </Text>
            </Box>
          ))}
        </Box>
        <Box display="flex" gap={3}>
          {SOBRAS.map((s) => (
            <Box flex={s.pct} paddingRight={8}>
              <Text fontSize={{ base: 11, tall: 13 }} color="#E9D9D3">
                {s.label}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
      <Text fontSize={{ base: 13, tall: 15 }} color="#C9A9A4" marginTop="auto" lineHeight={1.35}>
        Proporção ao volume entregue por cooperado. FATES é o fundo de assistência técnica, educacional e social, previsto na
        Lei 5.764/71.
      </Text>
    </Slide>
  </Deck>
));
