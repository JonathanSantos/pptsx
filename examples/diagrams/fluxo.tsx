import { Box, Connector, Deck, Slide, Text, defineDeck } from 'pptsx';
import type { ShapeKind } from 'pptsx';

// M12-5: fluxograma nativo. Cada nó é um Box com `shape` (o texto fica dentro do padding) e
// um `id`; os Connector ligam os ids depois do layout. Tudo editável no PowerPoint.

interface NodeProps {
  readonly id: string;
  readonly shape: ShapeKind;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly children: string;
}

const Node = ({ id, shape, left, top, width, height, color, children }: NodeProps) => (
  <Box id={id} shape={shape} position="absolute" left={left} top={top} width={width} height={height}
    backgroundColor={color} justifyContent="center" alignItems="center" padding={shape === 'parallelogram' || shape === 'hexagon' ? '0 22' : '0 8'}>
    <Text fontSize={12} color="#FFFFFF" textAlign="center">{children}</Text>
  </Box>
);

const LABEL = { fontSize: 11, color: '#1B2A4A', background: '#FFFFFF' } as const;

export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor="#FFFFFF">
      <Text position="absolute" left={30} top={18} fontSize={22} fontWeight="bold" color="#1B2A4A">Fluxo de pedido</Text>
      <Node id="inicio" shape="pill" left={30} top={80} width={90} height={40} color="#1B2A4A">Início</Node>
      <Node id="pedido" shape="parallelogram" left={150} top={75} width={140} height={50} color="#8B5CF6">Receber pedido</Node>
      <Node id="validar" shape="roundRect" left={320} top={75} width={110} height={50} color="#2F6FED">Validar dados</Node>
      <Node id="ok" shape="diamond" left={470} top={55} width={110} height={90} color="#F59E0B">Dados ok?</Node>
      <Node id="processar" shape="hexagon" left={610} top={75} width={100} height={50} color="#10B981">Processar</Node>
      <Node id="corrigir" shape="roundRect" left={465} top={225} width={120} height={50} color="#EF4444">Corrigir cadastro</Node>
      <Node id="fim" shape="pill" left={310} top={335} width={120} height={40} color="#1B2A4A">Fim</Node>

      <Connector from="inicio" to="pedido" />
      <Connector from="pedido" to="validar" />
      <Connector from="validar" to="ok" />
      <Connector from="ok" to="processar" label="sim" labelStyle={LABEL} />
      <Connector from="ok" to="corrigir" label="não" labelStyle={LABEL} />
      <Connector from="corrigir" to="validar" fromSide="left" toSide="bottom" route="elbow" lineStyle="dashed" />
      <Connector from="processar" to="fim" fromSide="bottom" toSide="right" route="elbow" />
      <Connector from="corrigir" to="fim" fromSide="bottom" toSide="top" route="elbow" label="cancelar" labelStyle={LABEL} stroke="#EF4444" />
    </Slide>
  </Deck>
));
