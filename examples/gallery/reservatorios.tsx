import { Box, Chart, Deck, Slide, Table, Text, defineDeck, type DeckContext } from 'pptsx';

// Galeria · Painel semanal do centro de controle de uma companhia de saneamento (fictícia).
//
// Paleta: sala de controle de dia, não "dark mode".
//   noite  #0B1F33 — tinta e a faixa de status do topo
//   água   #0A8FC7 — o que é água tratada; séries principais dos gráficos
//   nível  #7CCDEB — o enchimento dos reservatórios
//   painel #EEF2F5 — fundo; cartões brancos com sombra curta
//   estados: ok #1F9D63 · alerta #E8A21A · crítico #D93F3F (só para status, nunca decoração)
// Tipografia: só Arial. Números de painel grandes e compactos (letterSpacing negativo),
// rótulos de instrumento em caixa alta de 9 pt e horários em negrito tabulado.
// Assinatura: os reservatórios. Cada um é um Box com borda e raio, o nível é um Box absoluto
// com height em % e a linha de mínimo operacional é uma borda tracejada; o número fica por cima com zIndex.

const C = {
  noite: '#0B1F33',
  agua: '#0A8FC7',
  nivel: '#7CCDEB',
  painel: '#EEF2F5',
  muted: '#5E7186',
  linha: '#D3DCE5',
  ok: '#1F9D63',
  alerta: '#E8A21A',
  critico: '#D93F3F',
  branco: '#FFFFFF',
} as const;

type Status = 'ok' | 'alerta' | 'critico';
const STATUS_COLOR: Readonly<Record<Status, string>> = { ok: C.ok, alerta: C.alerta, critico: C.critico };
const STATUS_LABEL: Readonly<Record<Status, string>> = { ok: 'normal', alerta: 'atenção', critico: 'crítico' };

const TANKS: readonly { name: string; zone: string; level: number; status: Status }[] = [
  { name: 'R1 Alto do Céu', zone: 'Norte', level: 84, status: 'ok' },
  { name: 'R2 Caxangá', zone: 'Oeste', level: 71, status: 'ok' },
  { name: 'R3 Ibura', zone: 'Sul', level: 22, status: 'critico' },
  { name: 'R4 Dois Unidos', zone: 'Norte', level: 63, status: 'ok' },
  { name: 'R5 Jordão', zone: 'Sul', level: 38, status: 'alerta' },
  { name: 'R6 Várzea', zone: 'Oeste', level: 77, status: 'ok' },
];
const MIN_LEVEL = 30;

const ALERTS: readonly { at: string; where: string; what: string; status: Status; owner: string }[] = [
  { at: 'seg 06:12', where: 'R3 Ibura', what: 'Nível a 22%, abaixo do mínimo de 30%. Bomba B2 em manutenção.', status: 'critico', owner: 'Manutenção Sul' },
  { at: 'ter 14:40', where: 'Adutora Tapacurá', what: 'Pressão 18% abaixo do esperado no km 12. Suspeita de vazamento.', status: 'critico', owner: 'Redes' },
  { at: 'qua 09:05', where: 'R5 Jordão', what: 'Nível a 38% e caindo 2 pontos por hora no pico da manhã.', status: 'alerta', owner: 'Operação' },
  { at: 'qui 22:18', where: 'ETA Castelo', what: 'Turbidez da água bruta em 41 NTU depois da chuva.', status: 'alerta', owner: 'Tratamento' },
  { at: 'sex 03:30', where: 'Setor Várzea', what: 'Manobra programada concluída; abastecimento normalizado.', status: 'ok', owner: 'Operação' },
  { at: 'sáb 11:47', where: 'Booster Imbiribeira', what: 'Queda de energia de 14 min; gerador assumiu.', status: 'ok', owner: 'Elétrica' },
  { at: 'dom 17:02', where: 'R2 Caxangá', what: 'Telemetria sem sinal por 40 min; leitura manual feita.', status: 'ok', owner: 'Automação' },
];

const Instrument = ({ children, color = C.muted }: { children: string; color?: string }) => (
  <Text fontSize={9} fontWeight="bold" letterSpacing={1.8} textTransform="uppercase" color={color}>
    {children}
  </Text>
);

/** Faixa do topo: identifica o painel e resume o estado da semana em pílulas. */
const StatusBar = ({ title }: { title: string }) => (
  <Box display="flex" alignItems="center" gap={10} backgroundColor={C.noite} color={C.branco} padding="10 40">
    <Text fontSize={11} fontWeight="bold" letterSpacing={1.5}>
      CCO · CAV
    </Text>
    <Text fontSize={11} color="#9FB3C8" flex={1}>
      {title}
    </Text>
    {(
      [
        ['2 críticos', C.critico],
        ['2 em atenção', C.alerta],
        ['SLA 94%', C.ok],
      ] as const
    ).map(([label, bg]) => (
      <Text fontSize={9} fontWeight="bold" padding="3 9" borderRadius={10} backgroundColor={bg} color={C.branco}>
        {label}
      </Text>
    ))}
  </Box>
);

const Tank = ({ name, zone, level, status }: (typeof TANKS)[number]) => (
  <Box gap={8}>
    <Box flex={1} border={`2px solid ${C.linha}`} borderRadius={14} backgroundColor={C.branco} padding={10}>
      {/* Enchimento e linha de mínimo são absolutos; o número sobe com zIndex para ficar por cima. */}
      <Box
        position="absolute" left={4} right={4} bottom={4} height={`${level - 2}%`}
        borderRadius={10} backgroundColor={status === 'critico' ? '#F3B6B6' : C.nivel}
      />
      <Box
        position="absolute" left={0} width="100%" bottom={`${MIN_LEVEL}%`} height={0}
        borderTop={`1.5px dashed ${C.critico}`}
      />
      <Text position="relative" zIndex={2} fontSize={{ base: 26, tall: 32 }} fontWeight="bold" nowrap>
        {`${level}%`}
      </Text>
    </Box>
    <Box gap={2}>
      <Text fontSize={{ base: 11, tall: 12 }} fontWeight="bold" color={C.noite}>
        {name}
      </Text>
      <Text fontSize={9} color={STATUS_COLOR[status]} fontWeight="bold">
        {`${zone} · ${STATUS_LABEL[status]}`}
      </Text>
    </Box>
  </Box>
);

const KpiTile = ({ label, value, unit, note, status }: { label: string; value: string; unit: string; note: string; status: Status }) => (
  <Box backgroundColor={C.branco} borderRadius={10} padding="12 14" gap={4} boxShadow="0 2px 8px rgba(11,31,51,0.12)">
    <Instrument>{label}</Instrument>
    <Box display="flex" alignItems="baseline" gap={4}>
      <Text fontSize={{ base: 26, tall: 30 }} fontWeight="bold" letterSpacing={-1} color={C.noite} nowrap>
        {value}
      </Text>
      <Text fontSize={11} fontWeight="bold" color={C.muted} nowrap>
        {unit}
      </Text>
    </Box>
    <Text fontSize={10} fontWeight="bold" color={STATUS_COLOR[status]}>
      {note}
    </Text>
  </Box>
);

const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export default defineDeck((ctx: DeckContext) => (
  <Deck>
    {/* 1 · Reservatórios: seis tanques num grid; em 4:3 eles ganham altura e uma nota de leitura. */}
    <Slide backgroundColor={C.painel} color={C.noite}>
      <StatusBar title="Semana 41 · 6 a 12 de outubro de 2026" />
      <Box flex={1} padding={{ base: '20 40 28', tall: '28 40 36' }} gap={{ base: 16, tall: 22 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-end">
          <Box gap={4}>
            <Instrument>Reservatórios · domingo, 23h</Instrument>
            <Text fontSize={{ base: 24, tall: 28 }} fontWeight="bold">
              Ibura fechou abaixo do mínimo
            </Text>
          </Box>
          <Box display="flex" alignItems="center" gap={6}>
            <Box width={18} height={0} borderTop={`1.5px dashed ${C.critico}`} />
            <Text fontSize={9} color={C.muted} nowrap>
              {`mínimo operacional, ${MIN_LEVEL}%`}
            </Text>
          </Box>
        </Box>
        <Box display="grid" flex={1} gap={{ base: 14, tall: 16 }} gridTemplateColumns="repeat(6, minmax(0, 1fr))" gridTemplateRows="minmax(0, 1fr)">
          {TANKS.map((t) => (
            <Tank {...t} />
          ))}
        </Box>
        <Text fontSize={12} color={C.muted} lineHeight={1.35} display={{ base: 'none', tall: 'flex' }}>
          O nível é a média da última hora. Abaixo de 30% a pressão nas pontas de rede cai e os bairros altos ficam sem água
          primeiro: Ibura e Jordão abastecem 210 mil pessoas.
        </Text>
      </Box>
    </Slide>

    {/* 2 · KPIs com sombra e dois gráficos nativos em células de grid. */}
    <Slide backgroundColor={C.painel} color={C.noite}>
      <StatusBar title="Produção, consumo e perdas" />
      <Box flex={1} padding={{ base: '18 40 26', tall: '26 40 34' }} gap={{ base: 14, tall: 18 }}>
        <Box display="grid" gap={12} gridTemplateColumns="repeat(4, minmax(0, 1fr))">
          <KpiTile label="Água produzida" value="1,82" unit="mi m³" note="+3,1% na semana" status="ok" />
          <KpiTile label="Perdas na rede" value="31,4" unit="%" note="meta: 28% até dezembro" status="alerta" />
          <KpiTile label="Consumo médio" value="152" unit="L/hab/dia" note="dentro da faixa" status="ok" />
          <KpiTile label="Interrupções" value="7" unit="eventos" note="2 sem aviso prévio" status="critico" />
        </Box>
        <Box display="grid" flex={1} gap={12} gridTemplateColumns="3fr 2fr" gridTemplateRows="minmax(0, 1fr)">
          <Box backgroundColor={C.branco} borderRadius={10} padding={12} boxShadow="0 2px 8px rgba(11,31,51,0.12)">
            <Chart
              kind="line" flex={1} size={9} color={C.noite} title="Nível às 23h, Ibura e Jordão (%)"
              colors={[C.critico, C.alerta]}
              data={{
                categories: DAYS,
                series: [
                  { name: 'R3 Ibura', values: [61, 55, 48, 41, 33, 27, 22] },
                  { name: 'R5 Jordão', values: [58, 54, 47, 44, 41, 39, 38] },
                ],
              }}
            />
          </Box>
          <Box backgroundColor={C.branco} borderRadius={10} padding={12} boxShadow="0 2px 8px rgba(11,31,51,0.12)">
            <Chart
              kind="bar" flex={1} size={9} color={C.noite} title="Perdas por zona (%)" showValues
              colors={[C.alerta]}
              data={{ categories: ['Norte', 'Sul', 'Oeste', 'Centro'], series: [{ name: 'Perdas', values: [27.8, 38.6, 29.1, 30.2] }] }}
            />
          </Box>
        </Box>
      </Box>
    </Slide>

    {/* 3 · SLA: tabela nativa zebrada ao lado de um número grande com a meta. */}
    <Slide backgroundColor={C.painel} color={C.noite}>
      <StatusBar title="Ordens de serviço · prazo de atendimento" />
      <Box flex={1} padding={{ base: '22 40 28', tall: '30 40 36' }} gap={{ base: 16, tall: 22 }}>
        <Text fontSize={{ base: 24, tall: 28 }} fontWeight="bold">
          Vazamento em rua é o único tipo fora da meta
        </Text>
        <Box display="grid" flex={1} gap={20} gridTemplateColumns={{ base: 'minmax(0, 1fr) 150pt', tall: 'minmax(0, 1fr)' }} alignItems="start">
          <Table
            fontSize={{ base: 13, tall: 14 }} cellPadding={{ base: 8, tall: 8 }}
            header={{ fill: C.noite, color: C.branco }} stripe={C.branco} border={C.linha}
            columns={[
              { header: 'Tipo de serviço', width: '38%' },
              { header: 'Abertas', align: 'right' },
              { header: 'Prazo', align: 'right' },
              { header: 'No prazo', align: 'right' },
              { header: 'Mediana', align: 'right' },
            ]}
            rows={[
              ['Falta de água', '412', '24 h', '96%', '9 h'],
              ['Vazamento em rua', '286', '48 h', '81%', '31 h'],
              ['Ligação nova', '198', '7 dias', '97%', '3 dias'],
              ['Religação', '154', '48 h', '99%', '11 h'],
              ['Esgoto entupido', '231', '24 h', '93%', '14 h'],
              ['Conta contestada', '167', '10 dias', '98%', '4 dias'],
            ]}
          />
          <Box
            backgroundColor={C.branco} padding={16} gap={{ base: 6, tall: 18 }} borderTop={`5px solid ${C.ok}`} boxShadow="0 2px 8px rgba(11,31,51,0.12)"
            flexDirection={{ base: 'column', tall: 'row' }} alignItems={{ base: 'stretch', tall: 'center' }}
          >
            <Instrument>SLA geral</Instrument>
            <Text fontSize={48} fontWeight="bold" letterSpacing={-2} nowrap>
              94%
            </Text>
            <Text fontSize={11} color={C.muted} lineHeight={1.3} flexGrow={{ base: 0, tall: 1 }}>
              1.448 ordens na semana. Meta contratual: 92%.
            </Text>
          </Box>
        </Box>
        <Text fontSize={9} color={C.muted}>
          Meta por tipo: 90% no prazo. Vazamento em rua ficou em 81% porque 38 ordens esperaram liberação de trânsito.
        </Text>
      </Box>
    </Slide>

    {/* 4 · Alertas: borda esquerda pela gravidade; quantos aparecem depende da altura (ctx.pick). */}
    <Slide backgroundColor={C.painel} color={C.noite}>
      <StatusBar title="Alertas da semana, do mais antigo ao mais recente" />
      <Box flex={1} padding={{ base: '18 40 24', tall: '26 40 32' }} gap={8}>
        <Text fontSize={{ base: 24, tall: 28 }} fontWeight="bold" marginBottom={{ base: 6, tall: 10 }}>
          Quatro alertas continuam abertos
        </Text>
        {ALERTS.slice(0, ctx.pick({ base: 5, tall: 7 })).map((a) => (
          <Box
            display="flex" alignItems="center" gap={14} backgroundColor={C.branco}
            borderLeft={`5px solid ${STATUS_COLOR[a.status]}`} padding={{ base: '7 14', tall: '9 14' }}
          >
            <Text fontSize={10} fontWeight="bold" color={C.muted} width={62} flexShrink={0} nowrap>
              {a.at}
            </Text>
            <Text fontSize={12} fontWeight="bold" width={130} flexShrink={0}>
              {a.where}
            </Text>
            <Text fontSize={11} flex={1} lineHeight={1.25}>
              {a.what}
            </Text>
            <Text fontSize={9} fontWeight="bold" padding="3 8" borderRadius={9} backgroundColor={C.painel} color={C.muted} flexShrink={0} nowrap>
              {a.owner}
            </Text>
          </Box>
        ))}
        <Text fontSize={9} color={C.muted} marginTop="auto">
          Borda vermelha: crítico, ainda aberto · amarela: atenção · verde: resolvido.
        </Text>
      </Box>
    </Slide>
  </Deck>
));
