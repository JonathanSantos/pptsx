import { Box, Shape, Slide, Text, type DeckContext } from 'pptsx';
import { tokens } from '../tokens.ts';
import { circleDiameter } from './decor.ts';

export interface CoverLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Linha pequena no topo (área, data, evento). */
  readonly caption?: string;
  /** Contexto do deck: mantém a elipse circular e proporcional em qualquer tamanho. */
  readonly ctx?: DeckContext;
}

const { color, font, space } = tokens;

/**
 * Capa: fundo da marca, círculo decorativo no canto superior direito e o bloco de
 * título ancorado embaixo à esquerda. A diagonal círculo ↔ título equilibra o slide
 * em qualquer proporção (em 4:3 a altura extra fica entre os dois, não embaixo).
 */
export function CoverLayout({ title, subtitle, caption, ctx }: CoverLayoutProps) {
  const diameter = circleDiameter(ctx, 0.9);
  return (
    <Slide background={color.brand}>
      <Shape kind="ellipse" position="absolute" right={-diameter * 0.25} top={-diameter * 0.35}
        width={diameter} height={diameter} fill={color.brandDark} />
      <Box flex={1} justifyContent={caption ? "space-between" : "flex-end"} padding={{ top: space.page * 1.25, bottom: space.page * 1.5, left: space.page * 1.5, right: space.page * 1.5 }}>
        {caption ? (
          <Text fontSize={font.small} fontWeight="bold" color={color.accentSoft} maxWidth="55%">{caption}</Text>
        ) : null}
        <Box gap={space.gap}>
          <Shape kind="rect" width={56} height={6} fill={color.accent} flexShrink={0} />
          <Text fontSize={font.display} fontWeight="bold" color={color.white} fit="shrink" minSize={32}>{title}</Text>
          {subtitle ? (
            <Text fontSize={font.h2} color={color.accentSoft} fit="truncate" maxLines={2}>{subtitle}</Text>
          ) : null}
        </Box>
      </Box>
    </Slide>
  );
}
