import { Box, Shape, Slide, Text, type DeckContext, type Responsive } from '../index.ts';
import type { Child, Children, TextChildren } from '../../../src/core/types.ts';
import { mapResponsive } from '../../../examples/components/responsive.ts';
import { circleDiameter } from '../../../examples/layouts/decor.ts';
import { tokens } from '../../../examples/tokens.ts';

/**
 * Os layouts e componentes de examples/ reescritos em CSS (H1). Mesma aparência; o que muda
 * é como se escreve: borda no lugar de Shape-barra, margin auto no lugar de Box que empurra,
 * grid no lugar de colunas por grow, cor e fonte herdadas do Slide/cartão.
 */

const { color, font, space } = tokens;

// ───────────── layouts ─────────────

export interface CoverLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly caption?: string;
  readonly ctx?: DeckContext;
}

export function CoverLayout({ title, subtitle, caption, ctx }: CoverLayoutProps) {
  const diameter = circleDiameter(ctx, 0.9);
  return (
    <Slide background={color.brand} padding={`${space.page * 1.25} ${space.page * 1.5} ${space.page * 1.5}`} color={color.white}>
      <Shape kind="ellipse" position="absolute" right={-diameter * 0.25} top={-diameter * 0.35} width={diameter} height={diameter} fill={color.brandDark} zIndex={-1} />
      {caption ? <Text fontSize={font.small} fontWeight="bold" color={color.accentSoft} maxWidth="55%">{caption}</Text> : null}
      <Shape kind="rect" width={56} height={6} fill={color.accent} flexShrink={0} marginTop="auto" marginBottom={space.gap} />
      <Text fontSize={font.display} fontWeight="bold" minSize={32}>{title}</Text>
      {subtitle ? <Text fontSize={font.h2} color={color.accentSoft} marginTop={space.gap} fit="truncate" maxLines={2}>{subtitle}</Text> : null}
    </Slide>
  );
}

export interface ContentLayoutProps {
  readonly title: string;
  readonly justify?: 'start' | 'center';
  readonly notes?: string;
  readonly children?: Children;
}

export function ContentLayout({ title, justify = 'start', notes, children }: ContentLayoutProps) {
  return (
    <Slide background={color.white} padding={space.page} gap={space.gap * 1.5} color={color.ink} {...(notes ? { notes } : {})}>
      <Text fontSize={font.h1} fontWeight="bold" minSize={24} borderLeft={`6px solid ${color.accent}`} paddingLeft={20}>{title}</Text>
      <Box flex={1} justifyContent={justify === 'center' ? 'center' : 'flex-start'}>{children}</Box>
    </Slide>
  );
}

export interface ClosingLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly contact?: string;
  readonly ctx?: DeckContext;
}

export function ClosingLayout({ title, subtitle, contact, ctx }: ClosingLayoutProps) {
  const diameter = circleDiameter(ctx, 0.75);
  return (
    <Slide background={color.brand} padding={space.page * 1.5} justifyContent="center" gap={space.gap} textAlign="center" color={color.accentSoft}>
      <Shape kind="ellipse" position="absolute" left={-diameter * 0.4} bottom={-diameter * 0.4} width={diameter} height={diameter} fill={color.brandDark} zIndex={-1} />
      <Text fontSize={font.display} fontWeight="bold" color={color.white} minSize={32}>{title}</Text>
      <Shape kind="rect" width={56} height={6} fill={color.accent} alignSelf="center" flexShrink={0} />
      {subtitle ? <Text fontSize={font.h2} fit="truncate" maxLines={2} width="80%" alignSelf="center">{subtitle}</Text> : null}
      {contact ? <Text fontSize={font.small} marginTop={space.tight}>{contact}</Text> : null}
    </Slide>
  );
}

// ───────────── componentes ─────────────

export interface BulletsProps {
  readonly items: readonly TextChildren[];
  readonly size?: Responsive<number>;
  readonly gap?: Responsive<number>;
  readonly paginate?: boolean;
}

/** Marcador centrado na 1ª linha por margem (antes: Box só para o padding em volta do Shape). */
export function Bullets({ items, size = font.body, gap, paginate = false }: BulletsProps) {
  return (
    <Box gap={gap ?? mapResponsive(size, (s) => s * 0.7)} paginate={paginate} fontSize={size}>
      {items.map((item) => (
        <Box display="flex" gap={space.tight + 4} alignItems="flex-start">
          <Shape kind="ellipse" width={8} height={8} fill={color.accent} flexShrink={0} marginTop={mapResponsive(size, (s) => Math.max(0, s * 0.575 - 4))} />
          <Text flex={1} minSize={14}>{item}</Text>
        </Box>
      ))}
    </Box>
  );
}

export type KpiSize = 'sm' | 'md' | 'lg';
export interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: string;
  readonly trend?: 'up' | 'down';
  readonly sentiment?: 'positive' | 'negative' | 'neutral';
  readonly size?: Responsive<KpiSize>;
}

type KpiMetrics = { padding: number; gap: number; label: number; value: number; minValue: number };
const SIZES: Readonly<Record<KpiSize, KpiMetrics>> = {
  sm: { padding: space.tight + 4, gap: space.tight * 0.6, label: font.caption + 1, value: font.h1, minValue: 22 },
  md: { padding: space.gap, gap: space.tight, label: font.small, value: font.display, minValue: 28 },
  lg: { padding: space.gap, gap: space.tight * 1.2, label: font.small + 2, value: font.display + 12, minValue: 36 },
};
const SENTIMENT_COLOR = { positive: color.positive, negative: color.negative, neutral: color.muted } as const;

/** O cartão define fonte e cor uma vez; os textos herdam e só dizem o que muda. */
export function KpiCard({ label, value, delta, trend, sentiment, size = 'md' }: KpiCardProps) {
  const metric = (key: keyof KpiMetrics) => mapResponsive(size, (k) => SIZES[k][key]);
  const mood = sentiment ?? (trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral');
  const mark = trend === 'down' ? '▼ ' : trend === 'up' ? '▲ ' : '';
  return (
    <Box backgroundColor={color.surface} borderRadius={8} padding={metric('padding')} gap={metric('gap')} fontSize={metric('label')} color={color.muted}>
      <Text>{label}</Text>
      <Text fontSize={metric('value')} fontWeight="bold" color={color.ink} minSize={metric('minValue')}>{value}</Text>
      {delta ? <Text fontWeight="bold" color={SENTIMENT_COLOR[mood]}>{mark + delta}</Text> : null}
    </Box>
  );
}

/** Cartões de larguras iguais: uma linha de grid com tantas colunas quanto itens. */
export function KpiRow({ items, size }: { readonly items: readonly KpiCardProps[]; readonly size?: Responsive<KpiSize> }) {
  return (
    <Box display="grid" gridTemplateColumns={`repeat(${items.length}, 1fr)`} gap={space.gap}>
      {items.map((item) => <KpiCard {...(size ? { size } : {})} {...item} />)}
    </Box>
  );
}

/** Duas colunas em grid (antes: Box row + dois Box com grow); empilha com outro template. */
export function TwoColumn({ left, right, stacked, ratio = 0.5 }: { readonly left: Child; readonly right: Child; readonly stacked: Responsive<boolean>; readonly ratio?: number }) {
  const by = <T,>(side: T, column: T) => mapResponsive(stacked, (s) => (s ? column : side));
  return (
    <Box display="grid" flex={1} gridTemplateColumns={by(`${ratio}fr ${1 - ratio}fr`, '1fr')} gridTemplateRows={by('minmax(0, 1fr)', 'auto minmax(0, 1fr)')} gap={by(space.gap * 1.5, space.gap)} alignItems="start">
      {left}
      {right}
    </Box>
  );
}
