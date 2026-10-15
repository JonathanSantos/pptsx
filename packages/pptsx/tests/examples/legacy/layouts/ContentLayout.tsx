import { Box, Shape, Slide, Text, type Children } from 'pptsx';
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

/**
 * Slide de conteúdo: header com barra de destaque e corpo flexível que ocupa o resto.
 * justify="center" centraliza conteúdo curto (ex.: uma lista) na altura que sobra,
 * em vez de deixar a metade de baixo vazia em slides mais altos (4:3).
 */
export function ContentLayout({ title, justify = 'start', notes, children }: ContentLayoutProps) {
  return (
    <Slide background={color.white} padding={space.page} gap={space.gap * 1.5} {...(notes ? { notes } : {})}>
      <Box display="flex" alignItems="center" gap={14}>
        <Shape kind="rect" width={6} height={36} fill={color.accent} flexShrink={0} />
        <Text fontSize={font.h1} fontWeight="bold" color={color.ink} flex={1} minSize={24}>{title}</Text>
      </Box>
      <Box flex={1} justifyContent={justify === 'center' ? 'center' : 'flex-start'}>{children}</Box>
    </Slide>
  );
}
