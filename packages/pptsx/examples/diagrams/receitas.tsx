import { Box, Connector, Deck, Icon, Path, Shape, Slide, Text, defineDeck } from 'pptsx';

const STEPS = [
  { id: 'q1', label: 'Q1', text: 'Piloto em 2 lojas' },
  { id: 'q2', label: 'Q2', text: 'Rede sul' },
  { id: 'q3', label: 'Q3', text: 'Rede nacional' },
  { id: 'q4', label: 'Q4', text: 'App próprio' },
];

const Step = ({ id, shape, color, children }: { id: string; shape: 'pill' | 'roundRect' | 'diamond' | 'parallelogram'; color: string; children: string }) => (
  <Box id={id} shape={shape} width={shape === 'diamond' ? 120 : 130} height={shape === 'diamond' ? 80 : 46} backgroundColor={color}
    justifyContent="center" alignItems="center" padding={shape === 'parallelogram' ? '0 20' : '0 8'}>
    <Text fontSize={12} color="#FFFFFF" textAlign="center">{children}</Text>
  </Box>
);

const Card = ({ id, icon, title }: { id: string; icon: string; title: string }) => (
  <Box id={id} display="flex" alignItems="center" gap={8} padding="8 12" backgroundColor="#FFFFFF" border="1px solid #CBD5E1" borderRadius={6}>
    <Icon src={`../assets/icons/${icon}.svg`} size={20} color="#2F6FED" flexShrink={0} />
    <Text fontSize={12} fontWeight="bold">{title}</Text>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    <Slide padding="24 32" gap={16}>
      <Text fontSize={24} fontWeight="bold">Como um pedido é atendido</Text>
      <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gridTemplateRows="1fr 1fr" placeItems="center" flex={1}>
        <Step id="inicio" shape="pill" color="#1B2A4A">Pedido chega</Step>
        <Step id="validar" shape="roundRect" color="#2F6FED">Validar</Step>
        <Step id="ok" shape="diamond" color="#F59E0B">Estoque?</Step>
        <Step id="enviar" shape="roundRect" color="#10B981">Enviar</Step>
        <Box gridColumn={3} gridRow={2}><Step id="comprar" shape="parallelogram" color="#EF4444">Comprar</Step></Box>
      </Box>
      <Connector from="inicio" to="validar" />
      <Connector from="validar" to="ok" />
      <Connector from="ok" to="enviar" label="sim" labelStyle={{ background: '#FFFFFF' }} />
      <Connector from="ok" to="comprar" label="não" labelStyle={{ background: '#FFFFFF' }} />
      <Connector from="comprar" to="enviar" fromSide="right" toSide="bottom" route="elbow" />
    </Slide>
    <Slide padding="24 32" gap={16} backgroundColor="#F8FAFC">
      <Text fontSize={24} fontWeight="bold">Arquitetura</Text>
      <Box display="grid" gridTemplateColumns="1fr 1fr" columnGap={60} alignItems="center" flex={1}>
        <Box border="1.5px dashed #2F6FED" borderRadius={10} padding={12} gap={10}>
          <Text fontSize={11} fontWeight="bold" color="#2F6FED">CLIENTES</Text>
          <Card id="web" icon="globe" title="Site" />
          <Card id="app" icon="user" title="App" />
        </Box>
        <Box border="1.5px dashed #10B981" borderRadius={10} padding={12} gap={10}>
          <Text fontSize={11} fontWeight="bold" color="#10B981">BACKEND</Text>
          <Card id="api" icon="server" title="API" />
          <Card id="db" icon="database" title="Banco" />
        </Box>
      </Box>
      <Connector from="web" to="api" route="elbow" />
      <Connector from="app" to="api" route="elbow" />
      <Connector from="api" to="db" />
    </Slide>
    <Slide padding="24 32" gap={24}>
      <Text fontSize={24} fontWeight="bold">Roadmap</Text>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        {STEPS.map((step) => (
          <Box alignItems="center" gap={8} width={130}>
            <Box id={step.id} shape="ellipse" width={48} height={48} backgroundColor="#2F6FED" justifyContent="center" alignItems="center">
              <Text fontSize={14} fontWeight="bold" color="#FFFFFF">{step.label}</Text>
            </Box>
            <Text fontSize={13} textAlign="center">{step.text}</Text>
          </Box>
        ))}
      </Box>
      {STEPS.slice(1).map((step, index) => <Connector from={STEPS[index]!.id} to={step.id} strokeWidth={2} stroke="#94A3B8" />)}
      <Box display="flex" alignItems="center" gap={10}>
        <Path d="M0 12 L16 12 M10 6 L16 12 L10 18" stroke="#2F6FED" strokeWidth={2} lineCap="round" lineJoin="round" />
        <Shape kind="arrowRight" width={40} height={20} backgroundColor="#10B981" />
        <Shape kind="line" width={80} height={0} stroke="#1B2A4A" strokeWidth={2} endArrow="triangle" />
      </Box>
    </Slide>
  </Deck>
));
