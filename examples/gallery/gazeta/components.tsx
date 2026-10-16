import { Box, Text } from 'pptsx';
import { createVariants, defineComponent } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const kicker = createVariants({
  for: 'text',
  base: { fontFamily: 'Inter', fontWeight: 'bold', fontSize: font.kicker, letterSpacing: 2, textTransform: 'uppercase' },
  variants: { tone: { red: { color: color.red }, ink: { color: color.ink }, gray: { color: color.gray }, paper: { color: color.paper } } },
  defaults: { tone: 'red' },
});

export const Kicker = defineComponent({ name: 'Kicker' }, ({ children, tone }: { children: string; tone?: 'red' | 'ink' | 'gray' | 'paper' }) => (
  <Text {...kicker({ tone })}>{children}</Text>
));

/** Fio duplo do cabeçalho: grosso em cima, fino embaixo. */
export const DoubleRule = defineComponent({ name: 'DoubleRule' }, ({ tone = color.ink }: { tone?: string }) => (
  <Box gap={2}>
    <Box height={0} borderTop={`2.5px solid ${tone}`} />
    <Box height={0} borderTop={`0.75px solid ${tone}`} />
  </Box>
));

/** Colunas de texto corrido com fio vertical entre elas. */
export const Columns = defineComponent({ name: 'Columns' }, ({ texts }: { texts: readonly string[] }) => (
  <Box display="flex" flex={1} alignItems="flex-start">
    {texts.map((t, i) => (
      <Text
        flex={1} fontSize={font.body} lineHeight={1.42} textAlign="left" color={color.ink}
        paddingLeft={i === 0 ? 0 : space.col / 2} paddingRight={i === texts.length - 1 ? 0 : space.col / 2}
        borderLeft={i === 0 ? undefined : `0.75px solid ${color.rule}`}
      >
        {t}
      </Text>
    ))}
  </Box>
));

/** Capitular: a primeira letra em vermelho, três linhas de altura, ao lado do parágrafo. */
export const DropCap = defineComponent({ name: 'DropCap' }, ({ text }: { text: string }) => (
  <Box display="flex" gap={6} alignItems="flex-start">
    <Text fontSize={46} fontWeight="bold" lineHeight={0.82} color={color.red} marginTop={2}>{text.slice(0, 1)}</Text>
    <Text flex={1} fontSize={11} lineHeight={1.45} color={color.ink}>{text.slice(1)}</Text>
  </Box>
));

export const PullQuote = defineComponent({ name: 'PullQuote' }, ({ quote, by }: { quote: string; by: string }) => (
  <Box borderTop={`2px solid ${color.ink}`} borderBottom={`0.75px solid ${color.ink}`} padding="10 0" gap={6}>
    <Text fontSize={16} fontStyle="italic" lineHeight={1.3} color={color.ink}>{quote}</Text>
    <Kicker tone="gray">{by}</Kicker>
  </Box>
));
