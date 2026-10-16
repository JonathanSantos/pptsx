import { Box, Shape, Text } from 'pptsx';
import { createVariants, defineComponent } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const { color, font } = tokens;

export type Leaf = 'moss' | 'sage' | 'clay' | 'forest' | 'cream' | 'sand' | 'bark';

export const Overline = defineComponent({ name: 'Overline' }, ({ children, tone = 'clay' }: { children: string; tone?: Leaf }) => (
  <Text fontFamily="Inter" fontWeight={600} fontSize={font.small} letterSpacing={2.2} textTransform="uppercase" color={color[tone]}>
    {children}
  </Text>
));

export const Serif = defineComponent(
  { name: 'Serif' },
  ({ children, size = font.h1, tone = 'forest' }: { children: string; size?: number; tone?: Leaf }) => (
    <Text fontFamily="Big Caslon" fontSize={size} lineHeight={1.08} letterSpacing={-0.4} color={color[tone]}>
      {children}
    </Text>
  ),
);

/** Ramo: um caule fino e folhas (elipses giradas) alternando dos dois lados. */
export const Branch = defineComponent(
  { name: 'Branch' },
  ({ left, top, height, tones }: { left: number; top: number; height: number; tones: readonly Leaf[] }) => (
    <>
      <Box position="absolute" zIndex={-1} left={left} top={top} width={3} height={height} borderRadius={2} backgroundColor={color.sage} opacity={0.7} />
      {tones.map((tone, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const y = top + 16 + (i * (height - 60)) / Math.max(1, tones.length - 1);
        return (
          <Shape
            kind="ellipse" position="absolute" zIndex={-1}
            left={left + 1.5 - 22 + side * 30} top={y} width={44} height={96}
            rotate={side * 48} backgroundColor={color[tone]} opacity={tone === 'cream' ? 0.25 : 0.9}
          />
        );
      })}
    </>
  ),
);

const figure = createVariants({
  for: 'text',
  base: { fontFamily: 'Big Caslon', fontSize: font.number, lineHeight: 1, letterSpacing: -1.5 },
  variants: { tone: { forest: { color: color.forest }, clay: { color: color.clay }, moss: { color: color.moss } } },
  defaults: { tone: 'forest' },
});

export const Figure = defineComponent(
  { name: 'Figure' },
  ({ value, unit, label, tone }: { value: string; unit: string; label: string; tone?: 'forest' | 'clay' | 'moss' }) => (
    <Box flex={1} gap={6} paddingTop={12} borderTop={`1px solid ${color.forest}`}>
      <Box display="flex" alignItems="baseline" gap={6}>
        <Text {...figure({ tone })} nowrap>{value}</Text>
        <Text fontFamily="Big Caslon" fontSize={18} color={color.bark}>{unit}</Text>
      </Box>
      <Text fontFamily="Inter" fontSize={10} lineHeight={1.4} color={color.ink}>{label}</Text>
    </Box>
  ),
);

/** Paisagem abstrata: céu, sol e duas colinas, tudo dentro do quadro do cartão. */
export const Landscape = defineComponent(
  { name: 'Landscape' },
  ({ sky, sun, hills }: { sky: Leaf; sun: Leaf; hills: readonly [Leaf, Leaf] }) => (
    <Box height={104} backgroundColor={color[sky]} borderRadius={10}>
      <Shape kind="ellipse" position="absolute" right={26} top={16} width={30} height={30} backgroundColor={color[sun]} />
      <Shape kind="ellipse" position="absolute" left={-4} bottom={0} width={150} height={52} backgroundColor={color[hills[0]]} />
      <Shape kind="ellipse" position="absolute" right={-4} bottom={0} width={170} height={40} backgroundColor={color[hills[1]]} />
    </Box>
  ),
);
