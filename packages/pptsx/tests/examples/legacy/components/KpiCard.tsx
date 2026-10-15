import { Box, Text, type Responsive } from 'pptsx';
import { tokens } from '../tokens.ts';
import { mapResponsive } from './responsive.ts';

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
  /**
   * Escala do cartão; padrão 'md'. Use 'sm' para 4+ cartões ou valores longos, 'lg' com largura/altura sobrando.
   * Aceita `{ base: 'md', tall: 'lg' }`.
   */
  readonly size?: Responsive<KpiSize>;
  /**
   * Variação na mesma linha do valor, alinhada pela baseline ("52,4  ▲ +14,2%").
   * Padrão false (variação embaixo). Use com variações curtas: a linha precisa caber valor + variação.
   */
  readonly inlineDelta?: boolean;
}

const { color, font, space } = tokens;

/** Medidas por tamanho (pt). md é o cartão original; sm e lg escalam padding e tipografia juntos. */
type KpiMetrics = { padding: number; gap: number; label: number; value: number; minValue: number };
const SIZES: Readonly<Record<KpiSize, KpiMetrics>> = {
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
export function KpiCard({ label, value, delta, trend, sentiment, size = 'md', inlineDelta = false }: KpiCardProps) {
  // Cada medida deriva de size chave a chave: um size responsivo continua responsivo até a primitiva.
  const metric = (key: keyof KpiMetrics): Responsive<number> => mapResponsive(size, (k) => SIZES[k][key]);
  const s = { padding: metric('padding'), gap: metric('gap'), label: metric('label'), value: metric('value'), minValue: metric('minValue') };
  const deltaColor = SENTIMENT_COLOR[sentiment ?? defaultSentiment(trend)];
  const valueText = <Text fontSize={s.value} fontWeight="bold" color={color.ink} minSize={s.minValue}>{value}</Text>;
  const deltaText = delta ? (
    <Text fontSize={s.label} fontWeight="bold" color={deltaColor}>{trendMark(trend) + delta}</Text>
  ) : null;
  // baseline: a 1ª linha da variação pequena senta na mesma linha de base do valor grande,
  // sem calcular deslocamento a partir dos tamanhos (que mudam quando o fit encolhe o valor).
  const body = inlineDelta && deltaText ? (
    <Box display="flex" alignItems="baseline" gap={s.gap}>{valueText}{deltaText}</Box>
  ) : [valueText, deltaText];
  return (
    <Box flex={1} backgroundColor={color.surface} borderRadius={8} padding={s.padding} gap={s.gap}>
      <Text fontSize={s.label} color={color.muted}>{label}</Text>
      {body}
    </Box>
  );
}
