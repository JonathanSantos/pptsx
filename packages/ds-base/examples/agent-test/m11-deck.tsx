import { B, Box, Deck, Shape, Slide, Table, Text, defineDeck } from 'pptsx';
import { tokens } from '@pptsx/ds-base';

const { color, font, space } = tokens;

const tags = ['Logística', 'Atendimento', 'Infraestrutura', 'Compras', 'Qualidade', 'Segurança', 'Frota', 'Armazéns'];

const kpis = [
  { label: 'Pedidos entregues', value: '128,4 mil', delta: '+9,2% vs. Q2', tone: color.positive },
  { label: 'Entrega no prazo', value: '96,1%', delta: '+1,4 pp', tone: color.positive },
  { label: 'Tempo médio de ciclo', value: '31 h', delta: '−4 h', tone: color.positive },
  { label: 'Chamados abertos', value: '2.310', delta: '+12%', tone: color.negative },
  { label: 'Custo por pedido', value: 'R$ 18,70', delta: '−3,5%', tone: color.positive },
  { label: 'Disponibilidade', value: '99,82%', delta: 'meta 99,9%', tone: color.negative },
];

const actions = [
  'Renegociar contrato de frete da rota Sul até novembro',
  'Ampliar turno noturno do CD Campinas em duas equipes',
  'Migrar roteirização para o novo motor de otimização',
  'Reduzir backlog de chamados nível 2 abaixo de 300',
  'Revisar SLA com as três transportadoras regionais',
  'Automatizar conferência de notas fiscais na entrada',
  'Treinar 40 operadores no novo WMS',
  'Implantar inventário cíclico semanal nos armazéns',
  'Substituir 12 empilhadeiras com mais de 10 anos',
  'Publicar painel diário de ruptura para as lojas',
  'Auditar processo de devolução no e-commerce',
  'Fechar plano de contingência para a Black Friday',
];

const footer = 'Relatório de operações · Q3 2026 · dados fictícios';

export default defineDeck((ctx) => (
  <Deck>
    {/* 1. Capa: decoração atrás (zIndex negativo), tags com wrap, rodapé com marginTop auto */}
    <Slide padding={space.page} backgroundColor={color.brand} color={color.white} fontFamily="Arial">
      <Shape kind="ellipse" position="absolute" right={-110} top={-110} width={340} height={340}
        backgroundColor={color.brandDark} zIndex={-1} />
      <Text fontSize={font.caption} letterSpacing={2} textTransform="uppercase" color={color.accentSoft}>
        Diretoria de operações
      </Text>
      <Text fontSize={font.display} fontWeight="bold" marginTop="auto" marginBottom={8}>
        Relatório de operações
      </Text>
      <Text fontSize={font.h2} marginBottom={20}>Terceiro trimestre de 2026</Text>
      <Box display="flex" flexWrap="wrap" gap={8} marginRight={120}>
        {tags.map((tag) => (
          <Text fontSize={13} padding="5 12" backgroundColor={color.accentSoft} color={color.accent} borderRadius={12}>
            {tag}
          </Text>
        ))}
      </Box>
      <Text fontSize={font.caption} color={color.accentSoft} marginTop={24} paddingTop={8}
        borderTop="1px solid #3A4B70">
        {footer}
      </Text>
    </Slide>

    {/* 2. Grid de indicadores: 3 colunas, 2 em 4:3 */}
    <Slide padding={36} gap={16} backgroundColor={color.surface} color={color.ink} fontFamily="Arial">
      <Text fontSize={26} fontWeight="bold" borderLeft={`6px solid ${color.accent}`} paddingLeft={12}>
        Indicadores do trimestre
      </Text>
      <Box display="grid" gap={16} flex={1} gridAutoRows="minmax(0, 1fr)"
        gridTemplateColumns={{ base: 'repeat(3, minmax(0, 1fr))', tall: 'repeat(2, minmax(0, 1fr))' }}>
        {kpis.map((k) => (
          <Box backgroundColor={color.white} padding={14} justifyContent="center" borderTop={`4px solid ${k.tone}`}
            boxShadow="0 3px 10px rgba(27,42,74,0.18)" fontSize={12} color={color.muted}>
            <Text>{k.label}</Text>
            <Text fontSize={{ base: 28, tall: 34 }} fontWeight="bold" color={color.ink} marginTop={4} nowrap>{k.value}</Text>
            <Text fontWeight="bold" color={k.tone} marginTop={2}>{k.delta}</Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={font.caption} color={color.muted} marginTop="auto" paddingTop={8} borderTop="1px solid #CCD3E0">
        {footer} · gerado em {ctx.name}
      </Text>
    </Slide>

    {/* 3. Lista longa paginada */}
    <Slide padding={space.page} gap={16} backgroundColor={color.white} color={color.ink} fontFamily="Arial">
      <Text fontSize={font.h1} fontWeight="bold" borderLeft={`6px solid ${color.accent}`} paddingLeft={14}>
        Plano de ação para o Q4
      </Text>
      <Box paginate flex={1} gap={{ base: 16, tall: 10 }} fontSize={{ base: 20, tall: 18 }}>
        {actions.map((item, i) => (
          <Box display="flex" gap={10} alignItems="flex-start">
            <Text fontSize={14} fontWeight="bold" color={color.accent} flexShrink={0} width={24}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <Text flex={1} minSize={14}>{item}</Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={font.caption} color={color.muted} marginTop="auto" paddingTop={8} borderTop="1px solid #CCD3E0">
        {footer}
      </Text>
    </Slide>

    {/* 4. Tabela de SLA por região */}
    <Slide padding={space.page} gap={16} backgroundColor={color.white} color={color.ink} fontFamily="Arial">
      <Text fontSize={font.h1} fontWeight="bold" borderLeft={`6px solid ${color.accent}`} paddingLeft={14}>
        SLA por região
      </Text>
      <Text fontSize={16} color={color.muted} marginLeft={20}>
        Sul ficou <B>abaixo da meta</B> pelo segundo trimestre seguido.
      </Text>
      <Table
        columns={[{ header: 'Região', width: '34%' }, { header: 'Pedidos', align: 'right' },
          { header: 'No prazo', align: 'right' }, { header: 'Meta', align: 'right' }, { header: 'Δ Q2', align: 'right' }]}
        rows={[
          ['Sudeste', '58.200', '97,3%', '96,0%', '+1,1 pp'],
          ['Sul', '24.900', '93,8%', '96,0%', '−0,6 pp'],
          ['Nordeste', '21.400', '96,0%', '95,0%', '+2,3 pp'],
          ['Centro-Oeste', '13.700', '95,9%', '95,0%', '+1,8 pp'],
          ['Norte', '10.200', '94,7%', '94,0%', '+0,9 pp'],
        ]}
        fontSize={{ base: 16, tall: 18 }}
        cellPadding={6}
        header={{ fill: color.brand, color: color.white }}
        stripe={color.surface}
        border="#CCD3E0"
      />
      <Text fontSize={font.caption} color={color.muted} marginTop="auto" paddingTop={8} borderTop="1px solid #CCD3E0">
        {footer}
      </Text>
    </Slide>
  </Deck>
));
