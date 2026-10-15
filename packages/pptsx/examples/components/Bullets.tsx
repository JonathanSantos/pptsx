import { Box, Shape, Text, type Responsive } from 'pptsx';
import type { TextChildren } from 'pptsx';
import { tokens } from '../tokens.ts';
import { mapResponsive } from './responsive.ts';

export interface BulletsProps {
  /** Um item por marcador: string ou rich text (`['Receita subiu ', <B>14%</B>]`). */
  readonly items: readonly TextChildren[];
  /** fontSize dos itens em pt; padrão tokens.font.body. Aceita `{ base: 20, wide: 24 }`. */
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

const MARKER = 8;
// Meia altura da linha ('normal' ≈ 1.15 × size) menos meio marcador: centro do marcador na 1ª linha.
const markerOffsetOf = (size: number) => Math.max(0, size * 0.575 - MARKER / 2);

/**
 * Lista com marcador; os itens encolhem juntos (escopo do fit = Bullets) até 14 pt.
 * O fontSize vai no Box da lista e desce para os itens (herança); a cor vem de quem envolve
 * (ContentLayout define ink no Slide).
 *
 * Por que não `alignItems="baseline"`: a baseline de um Shape é a base dele, então o círculo
 * ficaria assentado na linha de base do texto, visivelmente baixo. Fica o `marginTop` pela
 * meia altura da linha, que acerta o centro visual da 1ª linha. Baseline é a ferramenta certa
 * entre textos de tamanhos diferentes (ver KpiCard inlineDelta).
 *
 * size responsivo: gap padrão e deslocamento do marcador derivam dele chave a chave
 * (mapResponsive), então seguem o mesmo breakpoint que o texto sem o componente ler ctx.
 */
export function Bullets({ items, size = font.body, gap, paginate = false }: BulletsProps) {
  return (
    <Box gap={gap ?? mapResponsive(size, (s) => s * 0.7)} paginate={paginate} fontSize={size}>
      {items.map((item) => (
        <Box display="flex" gap={space.tight + 4} alignItems="flex-start">
          <Shape kind="ellipse" width={MARKER} height={MARKER} backgroundColor={color.accent} flexShrink={0}
            marginTop={mapResponsive(size, markerOffsetOf)} />
          <Text flex={1} minSize={14}>{item}</Text>
        </Box>
      ))}
    </Box>
  );
}
