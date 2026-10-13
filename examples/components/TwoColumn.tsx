import { Box, type Child } from 'tsx-slides';
import { tokens } from '../tokens.ts';

export interface TwoColumnProps {
  readonly left: Child;
  readonly right: Child;
  /** Empilha as colunas (use com ctx.aspect < 1.5). */
  readonly stacked?: boolean;
  /** Fração da largura da coluna esquerda; padrão 0.5. Empilhado, a esquerda fica com a altura do conteúdo. */
  readonly ratio?: number;
}

const { space } = tokens;

/**
 * Duas colunas proporcionais por grow (grow = flex: n); vira coluna única quando stacked.
 * Lado a lado, as duas colunas começam no topo: o primeiro item de texto alinha com o
 * topo da imagem/cartão ao lado (centralizar fazia o texto "flutuar").
 * Empilhado, a parte de cima fica do tamanho do conteúdo e a de baixo (em geral uma
 * imagem com grow) ocupa o resto: dividir a altura pela proporção deixaria buracos.
 */
export function TwoColumn({ left, right, stacked = false, ratio = 0.5 }: TwoColumnProps) {
  if (stacked) {
    return (
      <Box direction="column" gap={space.gap} grow={1}>
        <Box>{left}</Box>
        <Box grow={1}>{right}</Box>
      </Box>
    );
  }
  return (
    <Box direction="row" gap={space.gap * 1.5} grow={1}>
      <Box grow={ratio}>{left}</Box>
      <Box grow={1 - ratio}>{right}</Box>
    </Box>
  );
}
