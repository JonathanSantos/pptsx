import { Box, Text } from 'tsx-slides';
import { tokens } from '../tokens.ts';

export interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: string;
  readonly trend?: 'up' | 'down';
}

const { color, font, space } = tokens;

const trendColor = (trend: KpiCardProps['trend']) =>
  trend === 'down' ? color.negative : trend === 'up' ? color.positive : color.muted;

const trendMark = (trend: KpiCardProps['trend']) =>
  trend === 'down' ? '▼ ' : trend === 'up' ? '▲ ' : '';

/**
 * Cartão de indicador: label, valor grande e variação colorida pela tendência.
 * grow={1}: numa KpiRow os cartões dividem a largura igualmente e esticam na altura.
 */
export function KpiCard({ label, value, delta, trend }: KpiCardProps) {
  return (
    <Box grow={1} fill={color.surface} radius={8} padding={space.gap} gap={space.tight}>
      <Text size={font.small} color={color.muted}>{label}</Text>
      <Text size={font.display} weight="bold" color={color.ink} minSize={28}>{value}</Text>
      {delta ? (
        <Text size={font.small} weight="bold" color={trendColor(trend)}>{trendMark(trend) + delta}</Text>
      ) : null}
    </Box>
  );
}
