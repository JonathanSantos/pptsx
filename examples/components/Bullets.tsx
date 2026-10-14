import { Box, Shape, Text } from 'pptsx';
import type { TextChildren } from 'pptsx';
import { tokens } from '../tokens.ts';

export interface BulletsProps {
  /** Um item por marcador: string ou rich text (`['Receita subiu ', <B>14%</B>]`). */
  readonly items: readonly TextChildren[];
  /** pt; padrão tokens.font.body */
  readonly size?: number;
  /** pt entre itens; padrão 0.7 × size. Aumente para ocupar slides mais altos (4:3). */
  readonly gap?: number;
}

const { color, font, space } = tokens;

/**
 * Lista com marcador; os itens encolhem juntos (escopo do fit = Bullets) até 14 pt.
 *
 * Por que não `align="baseline"`: a baseline de um Shape é a base dele, então o círculo
 * ficaria assentado na linha de base do texto, visivelmente baixo. Centralizá-lo no
 * x-height exigiria uma métrica que a engine não expõe. Fica o deslocamento pela meia
 * altura da linha, que acerta o centro visual da 1ª linha. Baseline é a ferramenta certa
 * entre textos de tamanhos diferentes (ver KpiCard inlineDelta).
 */
export function Bullets({ items, size = font.body, gap = size * 0.7 }: BulletsProps) {
  // Centraliza o marcador na primeira linha: meia altura de linha (~1.15 × size) menos meio marcador.
  const markerOffset = Math.max(0, size * 0.575 - 4);
  return (
    <Box gap={gap}>
      {items.map((item) => (
        <Box direction="row" gap={space.tight + 4} align="start">
          <Box padding={{ top: markerOffset }} shrink={0}>
            <Shape kind="ellipse" width={8} height={8} fill={color.accent} />
          </Box>
          <Text size={size} minSize={14} grow={1} color={color.ink}>{item}</Text>
        </Box>
      ))}
    </Box>
  );
}
