import { Box } from 'tsx-slides';
import { tokens } from '../tokens.ts';
import { KpiCard, type KpiCardProps } from './KpiCard.tsx';

export interface KpiRowProps {
  readonly items: readonly KpiCardProps[];
}

/** Linha de KPI cards de larguras iguais. */
export function KpiRow({ items }: KpiRowProps) {
  return (
    <Box direction="row" gap={tokens.space.gap}>
      {items.map((item) => (
        <KpiCard {...item} />
      ))}
    </Box>
  );
}
