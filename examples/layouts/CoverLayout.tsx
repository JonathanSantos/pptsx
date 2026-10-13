import { Box, Shape, Slide, Text } from 'tsx-slides';
import { tokens } from '../tokens.ts';

export interface CoverLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
}

const { color, font, space } = tokens;

/** Capa: fundo da marca, elipse decorativa e título grande alinhado à esquerda. */
export function CoverLayout({ title, subtitle }: CoverLayoutProps) {
  return (
    <Slide background={color.brand}>
      <Shape kind="ellipse" position="absolute" right="-12%" top="-30%" width="55%" height="100%" fill={color.brandDark} />
      <Box grow={1} justify="center" gap={space.gap} padding={{ top: space.page, bottom: space.page, left: space.page * 1.5, right: space.page * 1.5 }}>
        <Shape kind="rect" width={56} height={6} fill={color.accent} />
        <Text size={font.display} weight="bold" color={color.white} fit="shrink" minSize={32}>{title}</Text>
        {subtitle ? (
          <Text size={font.h2} color={color.accentSoft} fit="truncate" maxLines={2}>{subtitle}</Text>
        ) : null}
      </Box>
    </Slide>
  );
}
