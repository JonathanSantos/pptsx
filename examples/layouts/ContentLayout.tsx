import { Box, Shape, Slide, Text, type Children } from 'tsx-slides';
import { tokens } from '../tokens.ts';

export interface ContentLayoutProps {
  readonly title: string;
  readonly children?: Children;
}

const { color, font, space } = tokens;

/** Slide de conteúdo: header com barra de destaque e corpo flexível que ocupa o resto. */
export function ContentLayout({ title, children }: ContentLayoutProps) {
  return (
    <Slide background={color.white} padding={space.page} gap={space.gap * 1.5}>
      <Box direction="row" align="center" gap={14}>
        <Shape kind="rect" width={6} height={36} fill={color.accent} />
        <Text size={font.h1} weight="bold" color={color.ink} grow={1} minSize={24}>{title}</Text>
      </Box>
      <Box grow={1}>{children}</Box>
    </Slide>
  );
}
