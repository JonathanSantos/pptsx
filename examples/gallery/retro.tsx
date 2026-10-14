import { B, Box, Deck, I, Shape, Slide, Span, Text, defineDeck } from 'pptsx';

// Galeria · Retrospectiva trimestral de um time de produto (squad de pagamentos).
//
// Paleta: o quadro da retro depois da reunião.
//   quadro   #E3E7ED — fundo frio, de quadro branco usado
//   amarelo  #FFE36E · rosa #FFA3C0 · azul #A5DCFF · verde #BDF2AB — os blocos adesivos, um por tipo
//   marcador #1E2230 — a tinta; muted #596075
//   voto     #E5484D — os pontinhos de votação, e só eles
// Tipografia: só Arial. Títulos grandes e diretos; o texto dentro dos adesivos é negrito de
// 13–15 pt, curto, como escrito de pincel; datas em caixa alta com tracking.
// Assinatura: os adesivos. Cada bloco é um Box levemente girado (rotate ±1–3°) com sombra
// nativa; na capa eles se espalham com zIndex atrás do adesivo do título.

const C = {
  quadro: '#E3E7ED',
  amarelo: '#FFE36E',
  rosa: '#FFA3C0',
  azul: '#A5DCFF',
  verde: '#BDF2AB',
  marcador: '#1E2230',
  muted: '#596075',
  voto: '#E5484D',
  linha: '#B9C0CC',
  branco: '#FFFFFF',
} as const;

const SHADOW = '0 4px 10px rgba(30,34,48,0.22)';

type StickyProps = { color: string; tilt: number; votes?: number; children: string; size?: number | { base: number; tall: number }; fill?: boolean };

/** Um bloco adesivo: fundo, giro, sombra e os votos como pontinhos no canto. */
const Sticky = ({ color, tilt, votes = 0, children, size = 13, fill = false }: StickyProps) => (
  <Box backgroundColor={color} rotate={tilt} boxShadow={SHADOW} padding="10 12" gap={8} justifyContent="space-between" flexGrow={fill ? 1 : 0}>
    <Text fontSize={size} fontWeight="bold" color={C.marcador} lineHeight={1.2}>
      {children}
    </Text>
    <Box display={votes > 0 ? 'flex' : 'none'} gap={3} height={7}>
      {Array.from({ length: votes }, () => (
        <Shape kind="ellipse" width={7} height={7} backgroundColor={C.voto} flexShrink={0} />
      ))}
    </Box>
  </Box>
);

const Kicker = ({ children }: { children: string }) => (
  <Text fontSize={10} fontWeight="bold" letterSpacing={2} textTransform="uppercase" color={C.muted}>
    {children}
  </Text>
);

const EVENTS = [
  { date: '08 jul', title: 'Pix Automático em produção', note: 'Primeiro débito recorrente às 6h02, sem incidente.', incident: false },
  { date: '22 jul', title: 'Conciliação atrasou 6 horas', note: 'Fila travada por um lote de 40 mil estornos. Lojistas sem extrato até 14h.', incident: true },
  { date: '14 ago', title: 'Duas pessoas novas no time', note: 'Onboarding em pares; primeiro deploy delas no 4º dia.', incident: false },
  { date: '02 set', title: 'Gateway antigo desligado', note: '11 anos de código fora do ar, 0 transação perdida.', incident: false },
  { date: '25 set', title: 'NPS do lojista de 61 para 68', note: 'O extrato em tempo real foi o item mais citado.', incident: false },
] as const;

const COLUMNS = [
  {
    title: 'Funcionou',
    color: C.verde,
    notes: [
      ['Pareamento no onboarding', 5],
      ['Flag para desligar o gateway aos poucos', 4],
      ['Revisão de código antes das 11h', 2],
    ],
  },
  {
    title: 'Travou',
    color: C.rosa,
    notes: [
      ['Ninguém dono da fila de estornos', 6],
      ['Deploy na sexta à tarde', 3],
      ['Alertas demais no plantão', 3],
    ],
  },
  {
    title: 'Vamos tentar',
    color: C.azul,
    notes: [
      ['Dono rotativo da conciliação', 5],
      ['Congelar deploy depois das 15h de sexta', 4],
      ['Cortar alertas sem ação', 2],
    ],
  },
] as const;

const ACTIONS = [
  ['Escrever o runbook da fila de estornos', 'Marina', '18 out'],
  ['Escala rotativa da conciliação no calendário', 'Davi', '18 out'],
  ['Regra no CI: deploy bloqueado sexta depois das 15h', 'Lia', '25 out'],
  ['Revisar os 46 alertas do plantão e cortar os sem ação', 'Rafa', '25 out'],
  ['Painel de atraso da conciliação no telão', 'Davi', '01 nov'],
  ['Documentar o desligamento do gateway', 'Caio', '01 nov'],
  ['Teste de carga do Pix Automático com 5× o volume', 'Lia', '08 nov'],
  ['Retro de 30 min com o time de risco', 'Marina', '08 nov'],
  ['Mentoria de pares para as duas pessoas novas', 'Caio', '15 nov'],
  ['Medir o NPS do lojista de novo em dezembro', 'Rafa', '15 dez'],
] as const;

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: adesivos espalhados atrás (zIndex -1, girados) e o adesivo do título na frente. */}
    <Slide backgroundColor={C.quadro} color={C.marcador} padding={{ base: 48, tall: 56 }} justifyContent="center" alignItems="flex-start">
      {(
        [
          ['Pix', C.azul, 470, 40, 8],
          ['estornos!!', C.rosa, 560, 150, -6],
          ['deploy sexta?', C.verde, 440, 270, 4],
          ['NPS 68', C.amarelo, 600, 300, -3],
          ['gateway R.I.P.', C.azul, 60, 300, -5],
        ] as const
      ).map(([word, color, left, top, tilt]) => (
        <Box
          position="absolute" zIndex={-1} left={left} top={{ base: top, tall: top + 60 }} width={110} height={88}
          backgroundColor={color} rotate={tilt} boxShadow={SHADOW} padding={10}
        >
          <Text fontSize={13} fontWeight="bold">
            {word}
          </Text>
        </Box>
      ))}
      <Box
        width={{ base: 330, tall: 360 }} padding={{ base: 26, tall: 30 }} gap={10}
        backgroundColor={C.amarelo} rotate={-2.5} boxShadow="0 8px 18px rgba(30,34,48,0.28)"
      >
        <Kicker>Squad Pagamentos</Kicker>
        <Text fontSize={{ base: 44, tall: 50 }} fontWeight="bold" lineHeight={1}>
          Retro do 3º trimestre
        </Text>
        <Text fontSize={{ base: 14, tall: 16 }} lineHeight={1.3}>
          Julho a setembro de 2026. Sete pessoas, 41 adesivos, 10 ações com dono e prazo.
        </Text>
      </Box>
    </Slide>

    {/* 2 · Linha do tempo: a linha é o borderLeft de cada item; os pontos são Shapes absolutos. */}
    <Slide backgroundColor={C.quadro} color={C.marcador} padding={{ base: 40, tall: 48 }} gap={{ base: 16, tall: 24 }}>
      <Box gap={4}>
        <Kicker>O trimestre</Kicker>
        <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold">
          Um incidente no meio de três entregas grandes
        </Text>
      </Box>
      <Box display="grid" flex={1} gap={28} gridTemplateColumns="minmax(0, 1fr) 150pt" gridTemplateRows="minmax(0, 1fr)">
        <Box justifyContent="center" paddingLeft={8}>
          {EVENTS.map((e, i) => (
            <Box
              borderLeft={`2px solid ${C.linha}`} paddingLeft={22}
              paddingBottom={i === EVENTS.length - 1 ? 0 : { base: 10, tall: 18 }}
              gap={2}
            >
              <Shape
                kind="ellipse" position="absolute" left={-8} top={1} width={14} height={14}
                backgroundColor={e.incident ? C.voto : C.marcador} stroke={C.quadro} strokeWidth={3}
              />
              <Box display="flex" alignItems="baseline" gap={10}>
                <Text fontSize={9} fontWeight="bold" letterSpacing={1.5} textTransform="uppercase" color={e.incident ? C.voto : C.muted} width={44} flexShrink={0}>
                  {e.date}
                </Text>
                <Text fontSize={{ base: 14, tall: 16 }} fontWeight="bold" flex={1}>
                  {e.title}
                </Text>
              </Box>
              <Text fontSize={{ base: 11, tall: 13 }} color={C.muted} paddingLeft={54}>
                {e.note}
              </Text>
            </Box>
          ))}
        </Box>
        <Box gap={16} justifyContent="center">
          <Sticky color={C.amarelo} tilt={2} size={{ base: 14, tall: 16 }}>
            212 deploys, 3 rollbacks
          </Sticky>
          <Sticky color={C.rosa} tilt={-2} size={{ base: 14, tall: 16 }}>
            1 incidente sev-1, 6 h até resolver
          </Sticky>
          <Sticky color={C.verde} tilt={1.5} size={{ base: 14, tall: 16 }}>
            0 transação perdida na migração
          </Sticky>
        </Box>
      </Box>
    </Slide>

    {/* 3 · O quadro: três colunas de adesivos girados, com votos. */}
    <Slide backgroundColor={C.quadro} color={C.marcador} padding={{ base: 36, tall: 44 }} gap={{ base: 14, tall: 20 }}>
      <Box display="flex" justifyContent="space-between" alignItems="baseline">
        <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold">
          O quadro, depois da votação
        </Text>
        <Box display="flex" alignItems="center" gap={6}>
          <Shape kind="ellipse" width={7} height={7} backgroundColor={C.voto} />
          <Text fontSize={10} color={C.muted}>
            = um voto
          </Text>
        </Box>
      </Box>
      <Box display="grid" flex={1} gap={20} gridTemplateColumns="repeat(3, minmax(0, 1fr))" gridTemplateRows="minmax(0, 1fr)">
        {COLUMNS.map((col, ci) => (
          <Box gap={{ base: 12, tall: 16 }}>
            <Text fontSize={13} fontWeight="bold" paddingBottom={6} borderBottom={`3px solid ${col.color}`}>
              {col.title}
            </Text>
            {col.notes.map(([text, votes], ni) => (
              <Sticky color={col.color} tilt={[-2, 1.5, -1, 2.5, -1.5][(ci * 3 + ni) % 5]!} votes={votes} size={{ base: 13, tall: 15 }} fill>
                {text}
              </Sticky>
            ))}
          </Box>
        ))}
      </Box>
    </Slide>

    {/* 4 · Citações: rich text com I e Span em cartões com sombra. */}
    <Slide backgroundColor={C.quadro} color={C.marcador} padding={{ base: 40, tall: 48 }} gap={{ base: 16, tall: 22 }}>
      <Kicker>Ditos na sala</Kicker>
      <Box
        display="grid" flex={1} gap={16}
        gridTemplateColumns={{ base: '1.3fr 1fr', tall: 'minmax(0, 1fr)' }}
        gridTemplateRows={{ base: 'repeat(2, minmax(0, 1fr))', tall: 'auto repeat(2, minmax(0, 1fr))' }}
      >
        <Box gridRow={{ base: 'span 2', tall: 'span 1' }} backgroundColor={C.branco} borderRadius={4} padding={{ base: 24, tall: 26 }} gap={14} justifyContent="center" boxShadow={SHADOW}>
          <Text fontSize={{ base: 22, tall: 24 }} lineHeight={1.3}>
            “O estorno não era de ninguém. Quando travou, <I>todo mundo</I> olhou para a tela e{' '}
            <Span fontWeight="bold" color={C.voto}>
              ninguém abriu o runbook
            </Span>
            , porque ele não existia.”
          </Text>
          <Text fontSize={11} color={C.muted}>
            <B>Marina</B>, de plantão em 22 de julho
          </Text>
        </Box>
        <Box backgroundColor={C.verde} rotate={{ base: 1.5, tall: 0.6 }} padding={16} gap={8} justifyContent="center" boxShadow={SHADOW}>
          <Text fontSize={{ base: 14, tall: 16 }} lineHeight={1.3}>
            “Desligar o gateway com flag, <B>1% por dia</B>, foi a decisão mais chata e mais certa do trimestre.”
          </Text>
          <Text fontSize={10} color={C.muted}>
            <B>Caio</B>, tech lead
          </Text>
        </Box>
        <Box backgroundColor={C.azul} rotate={{ base: -1.5, tall: -0.6 }} padding={16} gap={8} justifyContent="center" boxShadow={SHADOW}>
          <Text fontSize={{ base: 14, tall: 16 }} lineHeight={1.3}>
            “No meu quarto dia eu já tinha feito deploy. <I>Isso</I> me convenceu a ficar.”
          </Text>
          <Text fontSize={10} color={C.muted}>
            <B>Lia</B>, entrou em agosto
          </Text>
        </Box>
      </Box>
    </Slide>

    {/* 5 · Ações: lista longa com paginate; título e rodapé se repetem em cada parte. */}
    <Slide backgroundColor={C.quadro} color={C.marcador} padding={{ base: 40, tall: 48 }} gap={{ base: 14, tall: 18 }}>
      <Box display="flex" justifyContent="space-between" alignItems="baseline">
        <Text fontSize={26} fontWeight="bold">
          Dez ações, cada uma com dono
        </Text>
        <Kicker>Revisão na retro do Q4</Kicker>
      </Box>
      <Box paginate flex={1} gap={{ base: 8, tall: 6 }}>
        {ACTIONS.map(([what, who, when]) => (
          <Box display="flex" alignItems="center" gap={12} flexShrink={0} backgroundColor={C.branco} padding={{ base: '9 14', tall: '6 14' }} boxShadow="0 1px 3px rgba(30,34,48,0.12)">
            <Box width={12} height={12} border={`2px solid ${C.marcador}`} borderRadius={3} flexShrink={0} />
            <Text fontSize={14} flex={1}>
              {what}
            </Text>
            <Text fontSize={11} fontWeight="bold" padding="2 10" borderRadius={10} backgroundColor={C.amarelo} flexShrink={0} nowrap>
              {who}
            </Text>
            <Text fontSize={10} fontWeight="bold" letterSpacing={1} color={C.muted} width={46} textAlign="right" flexShrink={0} nowrap>
              {when.toUpperCase()}
            </Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={9} color={C.muted}>
        Quadro completo e votos no mural da retro · squad Pagamentos
      </Text>
    </Slide>
  </Deck>
));
