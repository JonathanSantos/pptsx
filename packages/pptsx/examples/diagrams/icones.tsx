import { Box, Deck, Icon, Slide, Text, defineDeck } from 'pptsx';

// M12-4: ícones SVG viram formas nativas (um custGeom por traço). A cor vem de `color`
// (ou da cor de texto herdada, como o currentColor do CSS); o tamanho padrão é 24 pt de altura.

const ICONS = ['user', 'database', 'server', 'cloud', 'lock', 'mail', 'globe', 'chart', 'check', 'bolt', 'file', 'shield'] as const;
const COLORS = ['#1B2A4A', '#2F6FED', '#10B981'] as const;
const SIZES = [16, 24, 36] as const;

const src = (name: string) => `../assets/icons/${name}.svg`;

export default defineDeck(() => (
  <Deck>
    <Slide padding="20 32" gap={10} backgroundColor="#FFFFFF">
      <Text fontSize={22} fontWeight="bold" color="#1B2A4A">Ícones nativos: 12 × 3 cores × 3 tamanhos</Text>
      {SIZES.map((size, row) => (
        <Box display="flex" alignItems="center" gap={size / 3}>
          <Text fontSize={10} color="#64748B" width={40}>{`${size} pt`}</Text>
          {ICONS.map((name, index) => (
            <Icon src={src(name)} size={size} color={COLORS[(index + row) % COLORS.length]} />
          ))}
        </Box>
      ))}
      <Box display="flex" gap={16} alignItems="center" marginTop={6}>
        {ICONS.slice(0, 6).map((name) => (
          <Box display="flex" flexDirection="column" alignItems="center" gap={4} padding={10} backgroundColor="#F4F6FA" borderRadius={10} color="#8B5CF6">
            <Icon src={src(name)} size={28} />
            <Text fontSize={10}>{name}</Text>
          </Box>
        ))}
      </Box>
    </Slide>
    <Slide padding="20 32" gap={14} backgroundColor="#FFFFFF">
      <Text fontSize={22} fontWeight="bold" color="#1B2A4A">Quando o ícone vira imagem</Text>
      <Box display="flex" gap={40} alignItems="center">
        <Box alignItems="center" gap={6}>
          <Icon src="../assets/badge-gradiente.svg" size={72} />
          <Text fontSize={11} color="#44506A">gradiente → imagem (info)</Text>
        </Box>
        <Box alignItems="center" gap={6}>
          <Icon src={src('shield')} size={72} color="#EF4444" render="image" />
          <Text fontSize={11} color="#44506A">render="image" forçado</Text>
        </Box>
        <Box alignItems="center" gap={6}>
          <Icon src={src('shield')} size={72} color="#EF4444" rotate={15} opacity={0.6} />
          <Text fontSize={11} color="#44506A">forma: rotate e opacity</Text>
        </Box>
      </Box>
    </Slide>
  </Deck>
));
