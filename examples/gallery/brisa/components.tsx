import { Box, Shape, Text } from 'pptsx';
import { createVariants, defineComponent } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

export type Hue = 'mint' | 'peach' | 'lilac' | 'butter';
const DEEP: Readonly<Record<Hue, string>> = { mint: color.mintDeep, peach: color.peachDeep, lilac: color.lilacDeep, butter: color.butterDeep };

const SOFT_SHADOW = '0 8px 24px rgba(43,35,64,0.10)';

const card = createVariants({
  base: { borderRadius: space.radius, padding: 18, gap: 6 },
  variants: {
    hue: {
      white: { backgroundColor: color.card, boxShadow: SOFT_SHADOW },
      mint: { backgroundColor: color.mint },
      peach: { backgroundColor: color.peach },
      lilac: { backgroundColor: color.lilac },
      butter: { backgroundColor: color.butter },
    },
  },
  defaults: { hue: 'white' },
});

export const Card = defineComponent(
  { name: 'Card' },
  ({ hue, children, flex }: { hue?: Hue | 'white'; children?: unknown; flex?: number }) => (
    <Box {...card({ hue })} flex={flex}>{children as never}</Box>
  ),
);

export const Tag = defineComponent({ name: 'Tag' }, ({ children, hue }: { children: string; hue: Hue }) => (
  <Text alignSelf="flex-start" fontSize={font.small} fontWeight={600} padding="5 11" borderRadius={11} backgroundColor={color[hue]} color={DEEP[hue]} nowrap>
    {children}
  </Text>
));

/** Bolha decorativa: elipse pastel atrás do conteúdo. */
export const Blob = defineComponent(
  { name: 'Blob' },
  ({ hue, left, top, size }: { hue: Hue; left: number; top: number; size: number }) => (
    <Shape kind="ellipse" position="absolute" zIndex={-1} left={left} top={top} width={size} height={size} backgroundColor={color[hue]} />
  ),
);

export const Stat = defineComponent(
  { name: 'Stat' },
  ({ hue, label, value, note }: { hue: Hue; label: string; value: string; note: string }) => (
    <Box {...card({ hue })} flex={1} justifyContent="center" padding="14 18" gap={3}>
      <Text fontSize={font.small} fontWeight={600} color={DEEP[hue]}>{label}</Text>
      <Text fontSize={24} fontWeight="bold" letterSpacing={-0.8} color={color.ink} nowrap>{value}</Text>
      <Text fontSize={font.small} color={color.soft}>{note}</Text>
    </Box>
  ),
);

/** Meta com barra de progresso: trilho claro e preenchimento na cor profunda. */
export const Goal = defineComponent(
  { name: 'Goal' },
  ({ hue, glyph, name, saved, target }: { hue: Hue; glyph: 'star' | 'cloud' | 'hexagon' | 'diamond'; name: string; saved: number; target: number }) => {
    const pct = Math.round((saved / target) * 100);
    return (
      <Box display="flex" alignItems="center" gap={16} backgroundColor={color.card} borderRadius={18} padding="10 18" boxShadow={SOFT_SHADOW}>
        <Box width={36} height={36} borderRadius={18} backgroundColor={color[hue]} justifyContent="center" alignItems="center">
          <Shape kind={glyph} width={18} height={18} backgroundColor={DEEP[hue]} />
        </Box>
        <Box flex={1} gap={6}>
          <Box display="flex" justifyContent="space-between" alignItems="baseline">
            <Text fontSize={13} fontWeight="bold" color={color.ink}>{name}</Text>
            <Text fontSize={font.small} color={color.soft}>{`R$ ${saved.toLocaleString('pt-BR')} de ${target.toLocaleString('pt-BR')}`}</Text>
          </Box>
          <Box height={10} borderRadius={5} backgroundColor={color.track}>
            <Box width={`${pct}%`} height={10} borderRadius={5} backgroundColor={DEEP[hue]} />
          </Box>
        </Box>
        <Text width={40} textAlign="right" fontSize={15} fontWeight="bold" color={DEEP[hue]}>{`${pct}%`}</Text>
      </Box>
    );
  },
);
