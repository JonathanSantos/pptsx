import { Box, Connector, Deck, Icon, Slide, Text, defineDeck } from 'pptsx';

// M12-6: diagrama de arquitetura nativo. Grupos = Box com borda tracejada; serviços = cartões
// com Icon (SVG → formas) e um id; Connector em cotovelo liga os ids. Layout por grid: nada
// absoluto, então o mesmo deck serve em 16:9 e 4:3.

const icon = (name: string) => `../assets/icons/${name}.svg`;

const Service = ({ id, icon: name, title, detail }: { id: string; icon: string; title: string; detail: string }) => (
  <Box id={id} display="flex" alignItems="center" gap={8} padding="8 10" backgroundColor="#FFFFFF"
    border="1px solid #CBD5E1" borderRadius={6} boxShadow="0 1px 3px rgba(15,23,42,0.12)">
    <Icon src={icon(name)} size={22} flexShrink={0} />
    <Box flex={1} gap={1}>
      <Text fontSize={12} fontWeight="bold" color="#0F172A">{title}</Text>
      <Text fontSize={9} color="#64748B">{detail}</Text>
    </Box>
  </Box>
);

const Group = ({ title, color, children }: { title: string; color: string; children: unknown }) => (
  <Box border={`1.5px dashed ${color}`} borderRadius={10} padding="10 12 14" gap={14} color={color}>
    <Text fontSize={11} fontWeight="bold" letterSpacing={1} textTransform="uppercase">{title}</Text>
    {children as never}
  </Box>
);

const EDGE = { route: 'elbow', stroke: '#475569', strokeWidth: 1.25 } as const;

export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor="#F8FAFC" padding="18 28 24" gap={14}>
      <Text fontSize={22} fontWeight="bold" color="#0F172A">Arquitetura da plataforma</Text>
      <Box display="grid" gridTemplateColumns="1fr 1.25fr 1fr" columnGap={40} alignItems="center" flex={1}>
        <Group title="Clientes" color="#2F6FED">
          <Service id="usuarios" icon="user" title="Usuários" detail="web e app" />
          <Service id="email" icon="mail" title="E-mail" detail="entrada de pedidos" />
        </Group>
        <Group title="Nuvem" color="#8B5CF6">
          <Service id="auth" icon="shield" title="Auth" detail="OAuth e sessões" />
          <Service id="api" icon="server" title="API" detail="REST, 3 réplicas" />
          <Service id="workers" icon="bolt" title="Workers" detail="fila e jobs" />
        </Group>
        <Group title="Dados" color="#10B981">
          <Service id="postgres" icon="database" title="Postgres" detail="primário + réplica" />
          <Service id="storage" icon="cloud" title="Armazenamento" detail="arquivos e backups" />
          <Service id="analytics" icon="chart" title="Analytics" detail="painéis diários" />
        </Group>
      </Box>

      <Connector from="usuarios" to="api" fromSide="right" toSide="left" {...EDGE} />
      <Connector from="email" to="workers" fromSide="right" toSide="left" {...EDGE} />
      <Connector from="api" to="auth" fromSide="top" toSide="bottom" stroke="#475569" strokeWidth={1.25} startArrow="triangle" />
      <Connector from="api" to="postgres" fromSide="right" toSide="left" {...EDGE} />
      <Connector from="api" to="storage" fromSide="right" toSide="left" {...EDGE} />
      <Connector from="workers" to="analytics" fromSide="right" toSide="left" {...EDGE} lineStyle="dashed" label="eventos" labelStyle={{ fontSize: 9, color: '#475569', background: '#F8FAFC' }} />
    </Slide>
  </Deck>
));
