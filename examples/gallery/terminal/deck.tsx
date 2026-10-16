import { Box, Chart, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';
import { Badge, Gauge, Heading, Prompt, Window, type State } from './components.tsx';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const page = { backgroundColor: color.bg, color: color.text, fontFamily: 'Andale Mono', padding: space.page } as const;

const TIMELINE: readonly [string, State, string][] = [
  ['14:02', 'red', 'deploy 8f3a1c chega a 100% dos pods do worker de pagamentos'],
  ['14:05', 'amber', 'fila payments.capture passa de 2 mil mensagens; alerta dispara'],
  ['14:11', 'amber', 'plantão abre INC-2041 e chama o time de checkout'],
  ['14:23', 'blue', 'causa achada: timeout do cliente HTTP caiu de 30 s para 3 s'],
  ['14:31', 'green', 'rollback para 7d02e9; workers voltam a consumir'],
  ['14:49', 'green', 'fila zerada, 18.602 capturas processadas sem perda'],
];

const ACTIONS: readonly [boolean, string, string, string][] = [
  [true, 'teste de contrato para timeouts do cliente HTTP', '@marina', '10/10'],
  [true, 'alerta de fila a partir de 500 mensagens, não 2 mil', '@caio', '08/10'],
  [false, 'canary de 5% por 15 min no worker de pagamentos', '@bruno', '24/10'],
  [false, 'runbook de rollback em um comando', '@lia', '31/10'],
  [false, 'revisão de configs geradas por template', '@time-plataforma', '07/11'],
];

export default defineDeck(() => (
  <Deck>
    {/* 1 · Capa: janela de terminal com o prompt, o ID do incidente e os selos de estado. */}
    <Slide {...page}>
      <Window title="postmortem — zsh — 120×40">
        <Prompt>pptsx postmortem --incident INC-2041</Prompt>
        <Text fontSize={font.small} color={color.dim}>{'> carregando timeline, métricas e ações... ok (0,4 s)'}</Text>
        <Box flex={1} justifyContent="center" gap={10}>
          <Text fontSize={font.hero} color={color.text} letterSpacing={-2}>INC-2041</Text>
          <Text fontSize={18} color={color.amber}>Fila de pagamentos parada por 47 minutos</Text>
          <Box display="flex" gap={8} marginTop={6}>
            <Badge state="red">SEV-1</Badge>
            <Badge state="green">RESOLVIDO</Badge>
            <Badge>03/10/2026 · 14:02–14:49 BRT</Badge>
          </Box>
        </Box>
        <Prompt cursor>_</Prompt>
      </Window>
    </Slide>

    {/* 2 · Linha do tempo: trilho tracejado, ponto colorido por estado e o horário em âmbar. */}
    <Slide {...page} padding={`30 ${space.page * 1.6}`} gap={18}>
      <Heading>linha do tempo</Heading>
      <Box flex={1} justifyContent="space-between" paddingBottom={6}>
        <Box position="absolute" zIndex={-1} left={72} top={8} bottom={14} width={0} borderLeft={`1.5px dashed ${color.dim}`} />
        {TIMELINE.map(([at, state, what]) => (
          <Box display="flex" alignItems="center" gap={14}>
            <Text width={54} fontSize={14} color={color.amber}>{at}</Text>
            <Shape kind="ellipse" width={12} height={12} backgroundColor={color[state]} />
            <Text flex={1} fontSize={13} lineHeight={1.3} color={state === 'red' ? color.red : color.text}>{what}</Text>
          </Box>
        ))}
      </Box>
    </Slide>

    {/* 3 · Impacto: três medidores tracejados e um gráfico de área nativo da taxa de erro. */}
    <Slide {...page} padding={`30 ${space.page * 1.6}`} gap={14}>
      <Heading>impacto</Heading>
      <Box display="flex" gap={space.gap}>
        <Gauge label="p99 da captura" before="1,8 s" after="12,4 s" state="red" />
        <Gauge label="erros por minuto" before="3" after="2.140" state="red" />
        <Gauge label="pedidos na fila" before="0" after="18.602" state="amber" />
      </Box>
      <Box flex={1} border={`1px solid ${color.line}`} borderRadius={6} padding="10 12" backgroundColor={color.panel}>
        <Chart
          kind="area" flex={1} font="Andale Mono" size={8} color={color.dim} title="erros/min, 13:55–15:00"
          colors={[color.red]}
          data={{ categories: ['13:55', '14:00', '14:05', '14:10', '14:15', '14:20', '14:25', '14:30', '14:35', '14:40', '14:45', '14:50', '14:55', '15:00'], series: [{ name: 'erros/min', values: [3, 4, 380, 1450, 2140, 2090, 1980, 2010, 640, 90, 12, 5, 3, 4] }] }}
        />
      </Box>
    </Slide>

    {/* 4 · O que muda: checklist com dono e prazo, e o prompt final. */}
    <Slide {...page} padding={`30 ${space.page * 1.6}`} gap={14}>
      <Heading>o que muda</Heading>
      <Box flex={1} gap={0} justifyContent="center">
        {ACTIONS.map(([done, what, owner, due]) => (
          <Box display="flex" alignItems="center" gap={14} padding="13 0" borderBottom={`1px dashed ${color.line}`}>
            <Text fontSize={14} color={done ? color.green : color.dim}>{done ? '[x]' : '[ ]'}</Text>
            <Text flex={1} fontSize={13} color={done ? color.dim : color.text}>{what}</Text>
            <Text fontSize={11} color={color.amber}>{owner}</Text>
            <Text width={44} textAlign="right" fontSize={11} color={color.dim}>{due}</Text>
          </Box>
        ))}
      </Box>
      <Box display="flex" gap={10} alignItems="center">
        <Prompt>git commit -m "postmortem: INC-2041"</Prompt>
        <Badge state="green">exit 0</Badge>
      </Box>
    </Slide>
  </Deck>
));
