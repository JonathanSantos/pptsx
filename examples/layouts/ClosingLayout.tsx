import { Box, Shape, Slide, Text } from 'tsx-slides';
import { tokens } from '../tokens.ts';

export interface ClosingLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly contact?: string;
}

const { color, font, space } = tokens;

/**
 * Encerramento: fundo da marca, tudo centralizado.
 * Os textos ocupam a largura toda (align padrão 'stretch') e centralizam com align="center":
 * assim a quebra de linha usa a largura do slide, não a largura natural do texto.
 */
export function ClosingLayout({ title, subtitle, contact }: ClosingLayoutProps) {
  return (
    <Slide background={color.brand} padding={space.page * 1.5} justify="center" gap={space.gap}>
      <Shape kind="ellipse" position="absolute" left="-15%" bottom="-45%" width="50%" height="90%" fill={color.brandDark} />
      <Text size={font.display} weight="bold" color={color.white} align="center" minSize={32}>{title}</Text>
      <Shape kind="rect" width={56} height={6} fill={color.accent} alignSelf="center" />
      {subtitle ? (
        <Text size={font.h2} color={color.accentSoft} align="center" fit="truncate" maxLines={2}>{subtitle}</Text>
      ) : null}
      {contact ? (
        <Box padding={{ top: space.tight }}>
          <Text size={font.small} color={color.accentSoft} align="center">{contact}</Text>
        </Box>
      ) : null}
    </Slide>
  );
}
