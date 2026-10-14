import { Box, type Responsive } from 'pptsx';
import { tokens } from '../tokens.ts';
import { KpiCard, type KpiCardProps, type KpiSize } from './KpiCard.tsx';

export interface KpiRowProps {
  readonly items: readonly KpiCardProps[];
  /** Tamanho de todos os cartões (o size de um item vence); padrão 'md'. Aceita `{ base: 'md', wide: 'lg' }`. */
  readonly size?: Responsive<KpiSize>;
}

/**
 * Linha de KPI cards de larguras iguais: um grid de uma linha com uma coluna por item.
 * `minmax(0, 1fr)` e não `1fr`: o `1fr` do CSS nunca fica menor que a palavra mais longa
 * (min-content), então um valor como "R$ 52.400.000,00" alargaria a coluna e empurraria os
 * cartões para fora do slide; com mínimo 0 as colunas ficam iguais e o texto encolhe nelas.
 */
export function KpiRow({ items, size }: KpiRowProps) {
  return (
    <Box display="grid" gridTemplateColumns={`repeat(${items.length}, minmax(0, 1fr))`} gap={tokens.space.gap}>
      {items.map((item) => (
        <KpiCard {...(size ? { size } : {})} {...item} />
      ))}
    </Box>
  );
}
