import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';
import type { ShapeKind } from 'pptsx';

// M12-2: todas as formas curadas numa grade, cada uma com o nome embaixo. As formas são
// nativas (prstGeom): no PowerPoint dá para trocar a cor, redimensionar e girar.

const KINDS: readonly ShapeKind[] = [
  'rect', 'roundRect', 'ellipse', 'triangle', 'rightTriangle', 'diamond',
  'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'octagon', 'chevron',
  'arrowRight', 'arrowLeft', 'arrowUp', 'arrowDown', 'doubleArrow', 'pill',
  'star', 'cloud', 'callout', 'bracketPair', 'cylinder', 'line',
];

const Cell = ({ kind }: { kind: ShapeKind }) => (
  <Box display="flex" flexDirection="column" alignItems="center" gap={6}>
    <Shape kind={kind} width={64} height={kind === 'line' ? 0 : 40} marginTop={kind === 'line' ? 20 : 0}
      marginBottom={kind === 'line' ? 20 : kind === 'callout' ? 5 : 0}
      fill={kind === 'bracketPair' ? undefined : '#DCE6FB'} stroke="#2F6FED" strokeWidth={1.5} />
    <Text fontSize={10} color="#44506A">{kind}</Text>
  </Box>
);

const LINE_ROWS = [
  { label: 'endArrow triangle', props: { endArrow: 'triangle' } },
  { label: 'start oval, end stealth', props: { startArrow: 'oval', endArrow: 'stealth' } },
  { label: 'dashed, arrow', props: { lineStyle: 'dashed', endArrow: 'arrow' } },
  { label: 'dotted, round, diamond', props: { lineStyle: 'dotted', lineCap: 'round', endArrow: 'diamond' } },
] as const;

export default defineDeck(() => (
  <Deck>
    <Slide padding="24 32" gap={14} backgroundColor="#FFFFFF">
      <Text fontSize={22} fontWeight="bold" color="#1B2A4A">Formas nativas (24 kinds)</Text>
      <Box display="grid" gridTemplateColumns="repeat(6, 1fr)" rowGap={10} columnGap={8} flexGrow={1}>
        {KINDS.map((kind) => <Cell kind={kind} />)}
      </Box>
    </Slide>
    <Slide padding="24 32" gap={16} backgroundColor="#FFFFFF">
      <Text fontSize={22} fontWeight="bold" color="#1B2A4A">Linhas, setas, flip e Box shape</Text>
      <Box display="flex" gap={24} flexGrow={1}>
        <Box gap={18} width={280}>
          {LINE_ROWS.map((row) => (
            <Box gap={4}>
              <Text fontSize={11} color="#44506A">{row.label}</Text>
              <Shape kind="line" height={0} stroke="#1B2A4A" strokeWidth={2} {...row.props} />
            </Box>
          ))}
          <Box display="flex" gap={12} alignItems="center">
            <Shape kind="rightTriangle" width={50} height={40} fill="#F59E0B" />
            <Shape kind="rightTriangle" width={50} height={40} fill="#F59E0B" flipH />
            <Shape kind="rightTriangle" width={50} height={40} fill="#F59E0B" flipV />
            <Shape kind="line" width={50} height={40} stroke="#1B2A4A" strokeWidth={2} endArrow="triangle" flipH />
          </Box>
        </Box>
        <Box display="flex" flexWrap="wrap" gap={12} flex={1} alignContent="flex-start">
          <Box shape="hexagon" width={150} height={80} padding="10 30" backgroundColor="#2F6FED" justifyContent="center">
            <Text fontSize={13} color="#FFFFFF" textAlign="center">Box shape hexagon com texto</Text>
          </Box>
          <Box shape="diamond" width={120} height={80} backgroundColor="#10B981" justifyContent="center" alignItems="center">
            <Text fontSize={13} color="#FFFFFF">decisão?</Text>
          </Box>
          <Box shape="pill" width={150} height={44} border="2px solid #1B2A4A" justifyContent="center" alignItems="center">
            <Text fontSize={13} color="#1B2A4A">pill com borda</Text>
          </Box>
          <Box shape="parallelogram" width={150} height={60} backgroundColor="#8B5CF6" padding="0 24" justifyContent="center" boxShadow="2px 3px 6px rgba(0,0,0,0.3)">
            <Text fontSize={13} color="#FFFFFF">entrada / saída</Text>
          </Box>
          <Box shape="callout" width={150} height={60} backgroundColor="#FEF3C7" border="1.5px solid #F59E0B" padding={10} rotate={-4}>
            <Text fontSize={12} color="#78350F">callout girado com borda</Text>
          </Box>
          <Box shape="cylinder" width={80} height={90} backgroundColor="#64748B" justifyContent="flex-end" alignItems="center" paddingBottom={14}>
            <Text fontSize={12} color="#FFFFFF">dados</Text>
          </Box>
        </Box>
      </Box>
    </Slide>
  </Deck>
));
