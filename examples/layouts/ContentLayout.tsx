import { Box, Slide, Text, type Children } from 'pptsx';
import { tokens } from '../tokens.ts';

export interface ContentLayoutProps {
  readonly title: string;
  /** Posição vertical do conteúdo no corpo; padrão 'start' (logo abaixo do título). */
  readonly justify?: 'start' | 'center';
  /** Notas do apresentador; numa paginação vão para todas as partes. */
  readonly notes?: string;
  readonly children?: Children;
}

const { color, font, space } = tokens;

/** Barra do título: 6 pt de borda + 14 pt até o texto, a mesma geometria da antiga barra-Shape. */
const TITLE_BAR = { width: 6, gap: 14 } as const;

/**
 * Slide de conteúdo: título com barra de destaque (borderLeft) e corpo flexível que ocupa o resto.
 * justify="center" centraliza conteúdo curto (ex.: uma lista) na altura que sobra,
 * em vez de deixar a metade de baixo vazia em slides mais altos (4:3).
 * A cor do texto (ink) desce do Slide para todo o conteúdo.
 */
export function ContentLayout({ title, justify = 'start', notes, children }: ContentLayoutProps) {
  return (
    <Slide backgroundColor={color.white} padding={space.page} gap={space.gap * 1.5} color={color.ink} {...(notes ? { notes } : {})}>
      <Text fontSize={font.h1} fontWeight="bold" minSize={24}
        borderLeft={`${TITLE_BAR.width}px solid ${color.accent}`} paddingLeft={TITLE_BAR.gap}>{title}</Text>
      <Box flex={1} justifyContent={justify === 'center' ? 'center' : 'flex-start'}>{children}</Box>
    </Slide>
  );
}
