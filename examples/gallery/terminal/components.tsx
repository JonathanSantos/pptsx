import { Box, Shape, Text } from 'pptsx';
import { createVariants, defineComponent } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

export type State = 'green' | 'amber' | 'red' | 'blue' | 'dim';

/** Moldura de janela: barra com três pontos e o título, e o conteúdo dentro. */
export const Window = defineComponent(
  { name: 'Window' },
  ({ title, children }: { title: string; children?: unknown }) => (
    <Box flex={1} border={`1px solid ${color.line}`} borderRadius={10} backgroundColor={color.panel}>
      <Box display="flex" alignItems="center" gap={6} padding="8 12" borderBottom={`1px solid ${color.line}`}>
        {([color.red, color.amber, color.green] as const).map((c) => (
          <Shape kind="ellipse" width={8} height={8} backgroundColor={c} opacity={0.85} />
        ))}
        <Text flex={1} textAlign="center" fontSize={font.small} color={color.dim} marginRight={38}>{title}</Text>
      </Box>
      <Box flex={1} padding="16 22" gap={space.gap}>{children as never}</Box>
    </Box>
  ),
);

export const Prompt = defineComponent({ name: 'Prompt' }, ({ children, cursor = false }: { children: string; cursor?: boolean }) => (
  <Box display="flex" alignItems="center" gap={8}>
    <Text fontSize={font.body} color={color.green}>$</Text>
    <Text fontSize={font.body} color={color.text}>{children}</Text>
    {cursor ? <Box width={7} height={14} backgroundColor={color.green} /> : null}
  </Box>
));

const badge = createVariants({
  for: 'text',
  base: { fontSize: font.small, padding: '3 8', borderRadius: 3 },
  variants: {
    state: {
      green: { color: color.green, border: `1px solid ${color.green}` },
      amber: { color: color.amber, border: `1px solid ${color.amber}` },
      red: { color: color.bg, backgroundColor: color.red },
      blue: { color: color.blue, border: `1px solid ${color.blue}` },
      dim: { color: color.dim, border: `1px solid ${color.line}` },
    },
  },
  defaults: { state: 'dim' },
});

export const Badge = defineComponent({ name: 'Badge' }, ({ children, state }: { children: string; state?: State }) => (
  <Text {...badge({ state })} nowrap>{children}</Text>
));

export const Heading = defineComponent({ name: 'Heading' }, ({ children }: { children: string }) => (
  <Box display="flex" gap={8}>
    <Text fontSize={font.h1} color={color.green}>##</Text>
    <Text fontSize={font.h1} color={color.text}>{children}</Text>
  </Box>
));

/** Caixa de métrica com borda tracejada, à moda de um painel ASCII. */
export const Gauge = defineComponent(
  { name: 'Gauge' },
  ({ label, before, after, state }: { label: string; before: string; after: string; state: State }) => (
    <Box flex={1} border={`1px dashed ${color.line}`} padding="10 12" gap={6}>
      <Text fontSize={font.small} color={color.dim}>{label}</Text>
      <Box display="flex" alignItems="baseline" gap={8}>
        <Text fontSize={13} color={color.dim} nowrap>{before}</Text>
        <Text fontSize={13} color={color.dim}>→</Text>
        <Text fontSize={22} color={color[state]} nowrap>{after}</Text>
      </Box>
    </Box>
  ),
);
