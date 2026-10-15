import { Box, Deck, Path, Slide, Text, defineDeck } from 'pptsx';

// M12-3: geometria livre com Path (subconjunto do d do SVG → custGeom nativo).
// O logotipo usa arcos (A), cúbicas (C), quadráticas (Q/T), relativos e Z.

const LOGO_RING = 'M50 5 A45 45 0 1 1 49.99 5 Z M50 20 a30 30 0 1 0 0.01 0 Z';
const LOGO_WAVE = 'M14 58 Q32 38 50 58 T86 58';
const LOGO_LEAF = 'M50 28 C64 34 66 50 50 62 C34 50 36 34 50 28 Z';

const Card = ({ title, children }: { title: string; children?: unknown }) => (
  <Box display="flex" flexDirection="column" alignItems="center" gap={8} padding={12} backgroundColor="#F4F6FA" borderRadius={8}>
    {children as never}
    <Text fontSize={11} color="#44506A">{title}</Text>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    <Slide padding="24 32" gap={16} backgroundColor="#FFFFFF">
      <Text fontSize={22} fontWeight="bold" color="#1B2A4A">Path: logotipo e geometrias livres</Text>
      <Box display="flex" gap={24} alignItems="flex-start">
        <Box width={200} height={200} position="relative">
          <Path d={LOGO_RING} viewBox={[100, 100]} position="absolute" inset={0} fill="#2F6FED" />
          <Path d={LOGO_LEAF} viewBox={[100, 100]} position="absolute" inset={0} fill="#10B981" />
          <Path d={LOGO_WAVE} viewBox={[100, 100]} position="absolute" inset={0} stroke="#1B2A4A" strokeWidth={5} lineCap="round" />
        </Box>
        <Box display="grid" gridTemplateColumns="repeat(3, 120px)" gap={12}>
          <Card title="tamanho do viewBox">
            <Path d="M0 0 L60 0 L30 50 Z" fill="#F59E0B" />
          </Card>
          <Card title="width + proporção">
            <Path d="M0 10 h40 v-10 l20 20 l-20 20 v-10 h-40 z" width={80} fill="#8B5CF6" />
          </Card>
          <Card title="stroke round, dashed">
            <Path d="M0 30 C20 -10 40 70 60 30 S100 -10 100 30" width={96} stroke="#EF4444" strokeWidth={3} lineCap="round" lineJoin="round" lineStyle="dashed" />
          </Card>
          <Card title="sombra e opacidade">
            <Path d="M30 0 L37 22 L60 22 L41 36 L48 58 L30 44 L12 58 L19 36 L0 22 L23 22 Z" width={56} fill="#2F6FED" opacity={0.7} boxShadow="2px 3px 4px rgba(0,0,0,0.35)" />
          </Card>
          <Card title="rotate 20°">
            <Path d="M0 0 H50 V30 H0 Z M10 10 H40 V20 H10 Z" width={60} fill="#64748B" rotate={20} />
          </Card>
          <Card title="esticado (w e h)">
            <Path d="M0 50 A50 50 0 0 1 100 50 Z" viewBox={[100, 50]} width={90} height={60} fill="#14B8A6" stroke="#0F766E" strokeWidth={2} />
          </Card>
        </Box>
      </Box>
    </Slide>
  </Deck>
));
