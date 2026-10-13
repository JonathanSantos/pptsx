import { Box, Shape, Slide, Text, type Children } from 'tsx-slides';
import { tokens } from '../tokens.ts';

export interface ContentLayoutProps {
  readonly title: string;
  /** Posição vertical do conteúdo no corpo; padrão 'start' (logo abaixo do título). */
  readonly justify?: 'start' | 'center';
  readonly children?: Children;
}

const { color, font, space } = tokens;

/**
 * Slide de conteúdo: header com barra de destaque e corpo flexível que ocupa o resto.
 * justify="center" centraliza conteúdo curto (ex.: uma lista) na altura que sobra,
 * em vez de deixar a metade de baixo vazia em slides mais altos (4:3).
 */
export function ContentLayout({ title, justify = 'start', children }: ContentLayoutProps) {
  return (
    <Slide background={color.white} padding={space.page} gap={space.gap * 1.5}>
      <Box direction="row" align="center" gap={14}>
        <Shape kind="rect" width={6} height={36} fill={color.accent} shrink={0} />
        <Text size={font.h1} weight="bold" color={color.ink} grow={1} minSize={24}>{title}</Text>
      </Box>
      <Box grow={1} justify={justify}>{children}</Box>
    </Slide>
  );
}
