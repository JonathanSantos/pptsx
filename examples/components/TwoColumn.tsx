import { Box, type Child, type Responsive } from 'pptsx';
import { tokens } from '../tokens.ts';
import { mapResponsive } from './responsive.ts';

export interface TwoColumnProps {
  readonly left: Child;
  readonly right: Child;
  /**
   * true empilha (left em cima, right embaixo); padrão false (lado a lado).
   * Responsivo: `stacked={{ base: false, tall: true }}` empilha em 4:3.
   */
  readonly stacked?: Responsive<boolean>;
  /** Fração da largura da coluna esquerda lado a lado; padrão 0.5. Empilhado, a de cima fica com a altura do conteúdo. */
  readonly ratio?: number;
}

const { space } = tokens;

/**
 * Duas colunas num grid que ocupa o resto do corpo (flex 1).
 * Lado a lado: colunas `ratio fr` e `1 − ratio fr` (com mínimo 0, para uma palavra longa não
 * alargar a coluna além da proporção) numa linha que é a altura toda; cada item
 * estica na célula (o padrão do grid), então um Chart ocupa a coluna inteira e uma lista
 * começa no topo, alinhada com o topo da imagem/gráfico ao lado.
 * Empilhado: uma coluna, linha de cima `auto` (altura do conteúdo) e a de baixo com o resto
 * (`minmax(0, 1fr)`): dividir a altura pela proporção deixaria buracos.
 * Template e gap derivam de stacked chave a chave, então um stacked responsivo continua
 * responsivo até a primitiva e o componente não precisa de ctx.
 */
export function TwoColumn({ left, right, stacked = false, ratio = 0.5 }: TwoColumnProps) {
  const by = <T,>(side: T, column: T): Responsive<T> => mapResponsive(stacked, (s) => (s ? column : side));
  return (
    <Box display="grid" flex={1}
      gridTemplateColumns={by(`minmax(0, ${ratio}fr) minmax(0, ${1 - ratio}fr)`, 'minmax(0, 1fr)')}
      gridTemplateRows={by('minmax(0, 1fr)', 'auto minmax(0, 1fr)')}
      gap={by(space.gap * 1.5, space.gap)}>
      {left}
      {right}
    </Box>
  );
}
