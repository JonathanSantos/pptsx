import { Box, Connector, Deck, Slide, Text, defineDeck } from 'pptsx';

type StepShape = 'pill' | 'roundRect' | 'diamond' | 'parallelogram';

const SIZE: Record<StepShape, { width: number; height: number; padding: string }> = {
  pill: { width: 124, height: 44, padding: '0 10' },
  roundRect: { width: 124, height: 48, padding: '0 8' },
  parallelogram: { width: 132, height: 48, padding: '0 22' },
  diamond: { width: 120, height: 84, padding: '0 24' },
};

const Step = ({ id, shape, color, children }: { id: string; shape: StepShape; color: string; children: string }) => (
  <Box id={id} shape={shape} width={SIZE[shape].width} height={SIZE[shape].height} padding={SIZE[shape].padding}
    backgroundColor={color} borderRadius={shape === 'roundRect' ? 8 : undefined}
    justifyContent="center" alignItems="center" flexShrink={0}>
    <Text fontSize={12} color="#FFFFFF" textAlign="center" fontWeight="bold">{children}</Text>
  </Box>
);

const LABEL = { background: '#FFFFFF', fontSize: 11, color: '#1B2A4A' };

export default defineDeck(() => (
  <Deck>
    <Slide padding="28 32" gap={16} backgroundColor="#FFFFFF" color="#1B2A4A">
      <Text fontSize={26} fontWeight="bold" borderLeft="6px solid #2F6FED" paddingLeft={12}>Aprovação de uma proposta</Text>
      <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gridTemplateRows="1fr 1fr" placeItems="center" flex={1}>
        <Step id="inicio" shape="pill" color="#1B2A4A">Início</Step>
        <Step id="enviar" shape="parallelogram" color="#2F6FED">Enviar proposta</Step>
        <Step id="decisao" shape="diamond" color="#F59E0B">Orçamento ok?</Step>
        <Step id="fim" shape="pill" color="#10B981">Aprovada</Step>
        <Box gridColumn={3} gridRow={2}>
          <Step id="revisar" shape="roundRect" color="#EF4444">Revisar escopo</Step>
        </Box>
      </Box>
      <Text fontSize={11} color="#5B6680">Fluxo repete até o orçamento ser aprovado.</Text>
      <Connector from="inicio" to="enviar" fromSide="right" toSide="left" />
      <Connector from="enviar" to="decisao" fromSide="right" toSide="left" />
      <Connector from="decisao" to="fim" fromSide="right" toSide="left" label="sim" labelStyle={LABEL} />
      <Connector from="decisao" to="revisar" fromSide="bottom" toSide="top" label="não" labelStyle={LABEL} />
      <Connector from="revisar" to="enviar" fromSide="left" toSide="bottom" route="elbow" />
    </Slide>
  </Deck>
));
