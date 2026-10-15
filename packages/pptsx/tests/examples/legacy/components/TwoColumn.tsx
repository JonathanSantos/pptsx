import { Box, type Child, type FlexDirection, type Responsive } from 'pptsx';
import { tokens } from '../tokens.ts';
import { mapResponsive } from './responsive.ts';

export interface TwoColumnProps {
  readonly left: Child;
  readonly right: Child;
  /** 'row' lado a lado, 'column' empilhado; padrão 'row'. Ex.: `{ base: 'row', tall: 'column' }`. */
  readonly direction?: Responsive<FlexDirection>;
  /** Fração da largura da coluna esquerda lado a lado; padrão 0.5. Empilhado, a de cima fica com a altura do conteúdo. */
  readonly ratio?: number;
}

const { space } = tokens;

/**
 * Duas colunas proporcionais por grow (grow = flex: n); vira coluna única em 'column'.
 * Lado a lado, as duas colunas começam no topo: o primeiro item de texto alinha com o
 * topo da imagem/cartão ao lado (centralizar fazia o texto "flutuar").
 * Empilhado, a parte de cima fica do tamanho do conteúdo (grow 0) e a de baixo (em geral
 * uma imagem) ocupa o resto: dividir a altura pela proporção deixaria buracos.
 * Gap e grows derivam de direction chave a chave, então um direction responsivo continua
 * responsivo até a primitiva e o componente não precisa de ctx.
 */
export function TwoColumn({ left, right, direction = 'row', ratio = 0.5 }: TwoColumnProps) {
  const by = <T,>(row: T, column: T): Responsive<T> => mapResponsive(direction, (d) => (d === 'column' ? column : row));
  return (
    <Box display="flex" flexDirection={direction} gap={by(space.gap * 1.5, space.gap)} flex={1}>
      <Box flex={by<number | string>(ratio, '0 1 auto')}>{left}</Box>
      <Box flex={by(1 - ratio, 1)}>{right}</Box>
    </Box>
  );
}
