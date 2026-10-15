import { Box, Connector, Deck, Slide, Text, defineDeck } from 'pptsx';
import type { ShapeKind } from 'pptsx';

// M12-5: fluxograma nativo. Cada nó é um Box com `shape` (o texto fica dentro do padding) e um
// `id`, posicionado numa célula do grid; os Connector ligam os ids depois do layout. Tudo
// editável no PowerPoint. O mesmo deck serve em 16:9 e 4:3 (o grid se adapta).

interface NodeProps {
  readonly id: string;
  readonly shape: ShapeKind;
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly children: string;
}

const Node = ({ id, shape, column, row, width, height, color, children }: NodeProps) => (
  <Box id={id} shape={shape} gridColumn={column} gridRow={row} placeSelf="center" width={width} height={height}
    backgroundColor={color} justifyContent="center" alignItems="center" padding={shape === 'parallelogram' || shape === 'hexagon' ? '0 22' : '0 8'}>
    <Text fontSize={12} color="#FFFFFF" textAlign="center">{children}</Text>
  </Box>
);

const LABEL = { fontSize: 11, color: '#1B2A4A', background: '#FFFFFF' } as const;

export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor="#FFFFFF" padding="18 24 24" gap={12}>
      <Text fontSize={22} fontWeight="bold" color="#1B2A4A">Fluxo de pedido</Text>
      <Box display="grid" gridTemplateColumns="repeat(5, minmax(0, 1fr))" gridTemplateRows="repeat(3, 1fr)" columnGap={16} flex={1}>
        <Node id="inicio" shape="pill" column={1} row={1} width={90} height={40} color="#1B2A4A">Início</Node>
        <Node id="pedido" shape="parallelogram" column={2} row={1} width={116} height={50} color="#8B5CF6">Receber pedido</Node>
        <Node id="validar" shape="roundRect" column={3} row={1} width={110} height={50} color="#2F6FED">Validar dados</Node>
        <Node id="ok" shape="diamond" column={4} row={1} width={110} height={86} color="#F59E0B">Dados ok?</Node>
        <Node id="processar" shape="hexagon" column={5} row={1} width={110} height={50} color="#10B981">Processar</Node>
        <Node id="corrigir" shape="roundRect" column={4} row={2} width={120} height={50} color="#EF4444">Corrigir cadastro</Node>
        <Node id="fim" shape="pill" column={3} row={3} width={110} height={40} color="#1B2A4A">Fim</Node>
      </Box>

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
