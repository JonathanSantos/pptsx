import type * as Pptx from './pptx.ts';
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
/**
 * Estratégia usada quando EmitOptions.lineSpacing não é informado.
 * 'exact' (calibração M3-F, docs/work/reports/M3-calibration.md): com spcPct o
 * "100%" de cada renderizador é diferente (Keynote arredonda ascent/descent/
 * lineGap para pt inteiro e não aplica o múltiplo ao lineGap nem ao topo da 1ª
 * linha; PowerPoint usa outra base), enquanto spcPts é absoluto. O Keynote
 * trunca spcPts para pt inteiro, então fica até 1 pt/linha mais baixo que o
 * calculado, nunca mais alto.
 */
export declare const ACTIVE_LINE_SPACING: LineSpacingStrategy;
/**
 * Só vale para 'multiple' (e só com `lineHeight: 'normal'`): fator aplicado
 * sobre o 100% antes de ir ao pptx. 1 = sem correção; >1 abre as linhas, <1 aperta. Ajustado pela
 * calibração quando o "100%" do renderizador difere do lineHeight do medidor.
 */
export declare const LINE_SPACING_CALIBRATION = 1;
/**
 * Estratégias para `lineHeight: 'normal'`, o único caso em que a altura depende das métricas
 * da fonte e por isso do renderizador.
 */
export declare const LINE_SPACING_STRATEGIES: Readonly<Record<LineSpacingStrategy, (node: PositionedText) => LineSpacingOptions>>;
/**
 * M11: `lineHeight` numérico é CSS (múltiplo do fontSize, já aplicado pelo medidor em
 * `text.lineHeight`), uma altura absoluta que não depende da face: sempre `spcPts` exato,
 * qualquer que seja a estratégia. Um `spcPct` seria relativo à altura natural de cada
 * renderizador e daria outra altura.
 */
export declare const lineSpacingOf: (node: PositionedText, strategy?: LineSpacingStrategy) => LineSpacingOptions;
