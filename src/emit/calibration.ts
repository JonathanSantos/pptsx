import type * as Pptx from './pptx.ts';
import { textStyleOf } from '../core/defaults.ts';
import type { PositionedText } from '../core/types.ts';

/**
 * Ponto ÚNICO de calibração da emissão de texto. A calibração do M3 compara
 * as quebras/alturas calculadas (fontkit) com as do renderizador real e só
 * mexe neste arquivo.
 *
 * Duas formas de dizer ao renderizador a altura de linha (Strategy):
 * - 'multiple': `<a:lnSpc><a:spcPct/>` — múltiplo da altura "natural" que o
 *   PowerPoint/Keynote calculam a partir das métricas da fonte. Depende de
 *   como cada renderizador define "1.0", por isso o fator de calibração.
 * - 'exact': `<a:lnSpc><a:spcPts/>` — altura fixa em pt igual à que o medidor
 *   calculou; o renderizador não reinterpreta as métricas da fonte.
 */
export type LineSpacingStrategy = 'multiple' | 'exact';

/** Subconjunto de opções do pptxgenjs que define o espaçamento de linha. */
export type LineSpacingOptions = Pick<Pptx.TextPropsOptions, 'lineSpacing' | 'lineSpacingMultiple'>;

/** Estratégia usada quando EmitOptions.lineSpacing não é informado. */
export const ACTIVE_LINE_SPACING: LineSpacingStrategy = 'multiple';

/**
 * Só vale para 'multiple': fator aplicado sobre style.lineHeight antes de ir
 * ao pptx. 1 = sem correção; >1 abre as linhas, <1 aperta. Ajustado pela
 * calibração quando o "100%" do renderizador difere do lineHeight do medidor.
 */
export const LINE_SPACING_CALIBRATION = 1;

export const LINE_SPACING_STRATEGIES: Readonly<Record<LineSpacingStrategy, (node: PositionedText) => LineSpacingOptions>> = {
  multiple: (node) => ({ lineSpacingMultiple: textStyleOf(node.props).lineHeight * LINE_SPACING_CALIBRATION }),
  // pptxgenjs grava spcPts = round(pt × 100), ou seja, centésimos de pt.
  exact: (node) => ({ lineSpacing: node.text.lineHeight }),
};

export const lineSpacingOf = (node: PositionedText, strategy: LineSpacingStrategy = ACTIVE_LINE_SPACING): LineSpacingOptions =>
  LINE_SPACING_STRATEGIES[strategy](node);
