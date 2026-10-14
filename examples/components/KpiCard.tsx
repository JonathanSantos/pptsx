import { Box, Text } from 'pptsx';
import { tokens } from '../tokens.ts';

export type KpiSize = 'sm' | 'md' | 'lg';
export type KpiTrend = 'up' | 'down';
export type KpiSentiment = 'positive' | 'negative' | 'neutral';

export interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: string;
  /** Direção da variação: só define a seta (▲/▼). */
  readonly trend?: KpiTrend;
  /** Se a variação é boa ou ruim: define a cor. Padrão: up → positive, down → negative, sem trend → neutral. */
  readonly sentiment?: KpiSentiment;
  /** Escala do cartão; padrão 'md'. Use 'sm' para 4+ cartões ou valores longos, 'lg' com largura/altura sobrando. */
  readonly size?: KpiSize;
}

const { color, font, space } = tokens;

/** Medidas por tamanho (pt). md é o cartão original; sm e lg escalam padding e tipografia juntos. */
const SIZES: Readonly<Record<KpiSize, { padding: number; gap: number; label: number; value: number; minValue: number }>> = {
  sm: { padding: space.tight + 4, gap: space.tight * 0.6, label: font.caption + 1, value: font.h1, minValue: 22 },
  md: { padding: space.gap, gap: space.tight, label: font.small, value: font.display, minValue: 28 },
  lg: { padding: space.gap, gap: space.tight * 1.2, label: font.small + 2, value: font.display + 12, minValue: 36 },
};

const SENTIMENT_COLOR: Readonly<Record<KpiSentiment, string>> = {
  positive: color.positive,
  negative: color.negative,
  neutral: color.muted,
};

const defaultSentiment = (trend: KpiTrend | undefined): KpiSentiment =>
  trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral';

const trendMark = (trend: KpiTrend | undefined): string =>
  trend === 'down' ? '▼ ' : trend === 'up' ? '▲ ' : '';

/**
 * Cartão de indicador: label, valor grande e variação.
 * A seta vem de trend e a cor de sentiment: "Custo ▼ −22%" pode ser verde e
 * "Chamados ▲ +22%" vermelho.
 * grow={1}: numa KpiRow os cartões dividem a largura igualmente e esticam na altura.
 */
export function KpiCard({ label, value, delta, trend, sentiment, size = 'md' }: KpiCardProps) {
  const s = SIZES[size];
  const deltaColor = SENTIMENT_COLOR[sentiment ?? defaultSentiment(trend)];
  return (
    <Box grow={1} fill={color.surface} radius={8} padding={s.padding} gap={s.gap}>
      <Text size={s.label} color={color.muted}>{label}</Text>
      <Text size={s.value} weight="bold" color={color.ink} minSize={s.minValue}>{value}</Text>
      {delta ? (
        <Text size={s.label} weight="bold" color={deltaColor}>{trendMark(trend) + delta}</Text>
      ) : null}
    </Box>
  );
}
