import { Box, Shape, Text, type Responsive } from 'pptsx';
import type { TextChildren } from 'pptsx';
import { tokens } from '../tokens.ts';
import { mapResponsive } from './responsive.ts';

export interface BulletsProps {
  /** Um item por marcador: string ou rich text (`['Receita subiu ', <B>14%</B>]`). */
  readonly items: readonly TextChildren[];
  /** pt; padrão tokens.font.body. Aceita `{ base: 20, wide: 24 }`. */
  readonly size?: Responsive<number>;
  /** pt entre itens; padrão 0.7 × size. Aumente para ocupar slides mais altos (`{ base: 14, tall: 25 }`). */
  readonly gap?: Responsive<number>;
  /**
   * Itens que não cabem continuam num slide clonado (Box paginate) em vez de encolher.
   * Padrão false. Só um por slide; o resto do slide se repete em cada parte.
   */
  readonly paginate?: boolean;
}

const { color, font, space } = tokens;

// Meia altura de linha (~1.15 × size) menos meio marcador: centro do marcador na 1ª linha.
// O objeto padding inteiro é o valor responsivo: a engine não resolve chaves dentro dele.
const markerPaddingOf = (size: number) => ({ top: Math.max(0, size * 0.575 - 4) });

/**
 * Lista com marcador; os itens encolhem juntos (escopo do fit = Bullets) até 14 pt.
 *
 * Por que não `align="baseline"`: a baseline de um Shape é a base dele, então o círculo
 * ficaria assentado na linha de base do texto, visivelmente baixo. Centralizá-lo no
 * x-height exigiria uma métrica que a engine não expõe. Fica o deslocamento pela meia
 * altura da linha, que acerta o centro visual da 1ª linha. Baseline é a ferramenta certa
 * entre textos de tamanhos diferentes (ver KpiCard inlineDelta).
 *
 * size responsivo: gap padrão e deslocamento do marcador derivam dele chave a chave
 * (mapResponsive), então seguem o mesmo breakpoint que o texto sem o componente ler ctx.
 */
export function Bullets({ items, size = font.body, gap, paginate = false }: BulletsProps) {
  const markerPadding = mapResponsive(size, markerPaddingOf);
  return (
    <Box gap={gap ?? mapResponsive(size, (s) => s * 0.7)} paginate={paginate}>
      {items.map((item) => (
        <Box display="flex" gap={space.tight + 4} alignItems="flex-start">
          <Box padding={markerPadding} flexShrink={0}>
            <Shape kind="ellipse" width={8} height={8} fill={color.accent} />
          </Box>
          <Text fontSize={size} minSize={14} flex={1} color={color.ink}>{item}</Text>
        </Box>
      ))}
    </Box>
  );
}
