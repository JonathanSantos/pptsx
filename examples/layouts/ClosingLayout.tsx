import { Box, Shape, Slide, Text, type DeckContext } from 'tsx-slides';
import { tokens } from '../tokens.ts';
import { circleDiameter } from './decor.ts';

export interface ClosingLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly contact?: string;
  /** Contexto do deck: mantém a elipse circular e proporcional em qualquer tamanho. */
  readonly ctx?: DeckContext;
}

const { color, font, space } = tokens;

/**
 * Encerramento: fundo da marca, tudo centralizado.
 * O título ocupa a largura toda e centraliza com align="center"; o subtítulo tem
 * largura máxima (medida de leitura) e fica no centro, longe do círculo do canto,
 * que assim nunca passa por trás do texto.
 */
export function ClosingLayout({ title, subtitle, contact, ctx }: ClosingLayoutProps) {
  const diameter = circleDiameter(ctx, 0.75);
  return (
    <Slide background={color.brand} padding={space.page * 1.5} justify="center" gap={space.gap}>
      <Shape kind="ellipse" position="absolute" left={-diameter * 0.4} bottom={-diameter * 0.4}
        width={diameter} height={diameter} fill={color.brandDark} />
      <Text size={font.display} weight="bold" color={color.white} align="center" minSize={32}>{title}</Text>
      <Shape kind="rect" width={56} height={6} fill={color.accent} alignSelf="center" shrink={0} />
      {subtitle ? (
        <Text size={font.h2} color={color.accentSoft} align="center" fit="truncate" maxLines={2}
          width="80%" alignSelf="center">{subtitle}</Text>
      ) : null}
      {contact ? (
        <Box padding={{ top: space.tight }}>
          <Text size={font.small} color={color.accentSoft} align="center">{contact}</Text>
        </Box>
      ) : null}
    </Slide>
  );
}
