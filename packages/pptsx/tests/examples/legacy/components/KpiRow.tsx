import { Box, type Responsive } from 'pptsx';
import { tokens } from '../tokens.ts';
import { KpiCard, type KpiCardProps, type KpiSize } from './KpiCard.tsx';

export interface KpiRowProps {
  readonly items: readonly KpiCardProps[];
  /** Tamanho de todos os cartões (o size de um item vence); padrão 'md'. Aceita `{ base: 'md', wide: 'lg' }`. */
  readonly size?: Responsive<KpiSize>;
}

/** Linha de KPI cards de larguras iguais. */
export function KpiRow({ items, size }: KpiRowProps) {
  return (
    <Box display="flex" gap={tokens.space.gap}>
      {items.map((item) => (
        <KpiCard {...(size ? { size } : {})} {...item} />
      ))}
    </Box>
  );
}
