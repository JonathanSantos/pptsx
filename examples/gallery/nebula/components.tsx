import { Box, Shape, Text } from 'pptsx';
import { createVariants, defineComponent } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const { color, font } = tokens;

export type Tone = 'violet' | 'cyan' | 'lime' | 'pink';

export const Eyebrow = defineComponent({ name: 'Eyebrow' }, ({ children, tone = 'cyan' }: { children: string; tone?: Tone }) => (
  <Text fontFamily="Andale Mono" fontSize={font.micro} letterSpacing={2.4} textTransform="uppercase" color={color[tone]}>
    {children}
  </Text>
));

/** Brilho: três elipses concêntricas com opacidade crescente para o centro, atrás do conteúdo. */
export const Glow = defineComponent(
  { name: 'Glow' },
  ({ cx, cy, size, tone }: { cx: number; cy: number; size: number; tone: Tone }) => (
    <>
      {[1, 0.66, 0.36].map((k, i) => (
        <Shape
          kind="ellipse" position="absolute" zIndex={-1}
          left={cx - (size * k) / 2} top={cy - (size * k) / 2} width={size * k} height={size * k}
          backgroundColor={color[tone]} opacity={[0.12, 0.2, 0.34][i]}
        />
      ))}
    </>
  ),
);

/** Anel fino: um Box redondo só com borda. */
export const Ring = defineComponent(
  { name: 'Ring' },
  ({ cx, cy, size, tone = 'violet' }: { cx: number; cy: number; size: number; tone?: Tone }) => (
    <Box position="absolute" zIndex={-1} left={cx - size / 2} top={cy - size / 2} width={size} height={size} borderRadius={size / 2} border={`1px solid ${color[tone]}`} opacity={0.45} />
  ),
);

export const Chip = defineComponent({ name: 'Chip' }, ({ children, tone }: { children: string; tone: Tone }) => (
  <Box display="flex" alignItems="center" gap={7} padding="6 12" borderRadius={14} border={`1px solid ${color.line}`} backgroundColor={color.surface}>
    <Shape kind="ellipse" width={6} height={6} backgroundColor={color[tone]} />
    <Text fontSize={font.small} color={color.text} nowrap>{children}</Text>
  </Box>
));

const metricValue = createVariants({
  for: 'text',
  base: { fontSize: 34, fontWeight: 'bold', letterSpacing: -1.5 },
  variants: { tone: { violet: { color: color.violet }, cyan: { color: color.cyan }, lime: { color: color.lime }, pink: { color: color.pink } } },
  defaults: { tone: 'cyan' },
});

export const Metric = defineComponent(
  { name: 'Metric' },
  ({ label, value, note, tone }: { label: string; value: string; note: string; tone: Tone }) => (
    <Box backgroundColor={color.surface} border={`1px solid ${color.line}`} borderRadius={14} padding="13 18" gap={4}>
      <Box width={26} height={3} borderRadius={2} backgroundColor={color[tone]} />
      <Text fontSize={font.small} color={color.muted} marginTop={6}>{label}</Text>
      <Text {...metricValue({ tone })} nowrap>{value}</Text>
      <Text fontFamily="Andale Mono" fontSize={font.micro} color={color.muted}>{note}</Text>
    </Box>
  ),
);

export const Feature = defineComponent(
  { name: 'Feature' },
  ({ icon, title, text, tone }: { icon: 'hexagon' | 'star' | 'diamond' | 'pentagon' | 'octagon' | 'chevron'; title: string; text: string; tone: Tone }) => (
    <Box backgroundColor={color.surface} border={`1px solid ${color.line}`} borderRadius={14} padding="12 14" gap={5}>
      <Box width={28} height={28} borderRadius={8} backgroundColor={color.raised} justifyContent="center" alignItems="center">
        <Shape kind={icon} width={13} height={13} backgroundColor={color[tone]} />
      </Box>
      <Text fontSize={font.h2} fontWeight="bold" color={color.text} marginTop={2}>{title}</Text>
      <Text fontSize={font.small} color={color.muted} lineHeight={1.3}>{text}</Text>
    </Box>
  ),
);

/** Barra de comparação: trilho, preenchimento em % do maior valor e o número na ponta. */
export const BarRow = defineComponent(
  { name: 'BarRow' },
  ({ label, value, max, unit, hot = false }: { label: string; value: number; max: number; unit: string; hot?: boolean }) => (
    <Box display="flex" alignItems="center" gap={14}>
      <Text width={110} fontSize={font.small} color={hot ? color.text : color.muted} fontWeight={hot ? 'bold' : 'regular'}>{label}</Text>
      <Box flex={1} height={14} borderRadius={7} backgroundColor={color.raised}>
        <Box width={`${Math.max(2, (value / max) * 100)}%`} height={14} borderRadius={7} backgroundColor={hot ? color.cyan : color.line} />
      </Box>
      <Text width={64} fontFamily="Andale Mono" fontSize={font.small} color={hot ? color.cyan : color.muted} textAlign="right">{`${String(value).replace('.', ',')} ${unit}`}</Text>
    </Box>
  ),
);
