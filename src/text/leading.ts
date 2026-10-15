import { DEFAULTS } from '../core/defaults.ts';
import type { Pt, TextRun, TextStyle } from '../core/types.ts';

/** Caixa de uma linha: altura e distância do topo da linha até a baseline. */
export interface LineBox {
  readonly lineHeight: Pt;
  readonly ascent: Pt;
}

/**
 * Semântica CSS do `line-height` (M11): 'normal' é a linha natural da face; um número `n`
 * é `n × size`, e a diferença para a natural (a entrelinha, que pode ser negativa) se
 * divide meio acima e meio abaixo do conteúdo, então a baseline desce a meia-entrelinha.
 * Ponto único da regra para o fontkit e a estimativa (o emissor grava o mesmo `lineHeight`).
 */
export const lineBoxOf = (natural: LineBox, size: Pt, lineHeight: TextStyle['lineHeight']): LineBox => {
  if (lineHeight === 'normal') return natural;
  const used = lineHeight * size;
  const halfLeading = (used - natural.lineHeight) / 2;
  return { lineHeight: used, ascent: halfLeading + natural.ascent };
};

/**
 * M13: corpo em que um run é desenhado: sobrescrito/subscrito a `superscriptRatio` do corpo (o
 * renderizador reduz sozinho); a altura da linha continua a do corpo do Text.
 */
export const runSizeOf = (run: Pick<TextRun, 'verticalAlign'> | undefined, size: Pt): Pt =>
  run?.verticalAlign === 'super' || run?.verticalAlign === 'sub' ? size * DEFAULTS.text.superscriptRatio : size;

/** CSS letter-spacing: pt somados a cada caractere (code point), inclusive o último, como o browser. */
export const spacingOf = (text: string, letterSpacing: Pt): Pt => (letterSpacing === 0 ? 0 : letterSpacing * [...text].length);
