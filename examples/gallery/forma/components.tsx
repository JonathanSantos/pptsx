import { Box, Shape, Text } from 'pptsx';
import { createVariants, defineComponent } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const { color, font } = tokens;

export type Primary = 'red' | 'blue' | 'yellow' | 'black';

/** Cor do texto sobre cada primária: o amarelo pede preto, o resto pede branco. */
const inkOn = (tone: Primary | 'paper'): string => (tone === 'yellow' || tone === 'paper' ? color.black : color.white);

export const Display = defineComponent(
  { name: 'Display' },
  ({ children, size = font.display, tone = 'black' }: { children: string; size?: number; tone?: Primary }) => (
    <Text fontFamily="DIN Condensed" fontSize={size} lineHeight={1.2} letterSpacing={-0.5} textTransform="uppercase" color={color[tone]}>
      {children}
    </Text>
  ),
);

export const Label = defineComponent({ name: 'Label' }, ({ children, tone = 'black' }: { children: string; tone?: Primary | 'white' }) => (
  <Text fontFamily="Inter" fontWeight="bold" fontSize={font.micro} letterSpacing={2.4} textTransform="uppercase" color={color[tone]}>
    {children}
  </Text>
));

const block = createVariants({
  base: { padding: '12 14', gap: 2 },
  variants: {
    tone: {
      red: { backgroundColor: color.red, color: color.white },
      blue: { backgroundColor: color.blue, color: color.white },
      yellow: { backgroundColor: color.yellow, color: color.black },
      black: { backgroundColor: color.black, color: color.white },
      paper: { backgroundColor: color.paper, color: color.black, border: `2px solid ${color.black}` },
    },
  },
  defaults: { tone: 'red' },
});

/** Bloco de número do mosaico: número gigante em DIN e o rótulo em Inter. */
export const NumberBlock = defineComponent(
  { name: 'NumberBlock' },
  ({ value, label, tone, span = 1, rows = 1 }: { value: string; label: string; tone: Primary | 'paper'; span?: number; rows?: number }) => (
    <Box {...block({ tone })} gridColumn={`span ${span}`} gridRow={`span ${rows}`} justifyContent="flex-end">
      <Text fontFamily="DIN Condensed" fontSize={span > 1 || rows > 1 ? 96 : 58} lineHeight={1.2}>{value}</Text>
      <Text fontFamily="Inter" fontWeight="bold" fontSize={font.micro} letterSpacing={2} textTransform="uppercase" color={inkOn(tone)}>{label}</Text>
    </Box>
  ),
);

/** Retrato geométrico: fundo de cor, cabeça em círculo e ombros num trapézio. */
export const Portrait = defineComponent(
  { name: 'Portrait' },
  ({ bg, head, body }: { bg: Primary; head: Primary; body: Primary }) => (
    <Box height={128} backgroundColor={color[bg]} alignItems="center" justifyContent="flex-end" gap={6}>
      <Shape kind="ellipse" width={46} height={46} backgroundColor={color[head]} />
      <Shape kind="trapezoid" width={92} height={52} backgroundColor={color[body]} />
    </Box>
  ),
);

export const Session = defineComponent(
  { name: 'Session' },
  ({ time, title, who }: { time: string; title: string; who: string }) => (
    <Box display="flex" gap={10} paddingBottom={7} borderBottom={`1.5px solid ${color.black}`} alignItems="flex-start">
      <Text fontFamily="DIN Condensed" fontSize={20} lineHeight={1.2} width={44} color={color.black}>{time}</Text>
      <Box flex={1} gap={2}>
        <Text fontFamily="Inter" fontWeight="bold" fontSize={10.5} lineHeight={1.2}>{title}</Text>
        <Text fontFamily="Inter" fontSize={8.5} color="#55504A">{who}</Text>
      </Box>
    </Box>
  ),
);
