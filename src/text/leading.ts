import type { Pt, TextStyle } from '../core/types.ts';

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

/** CSS letter-spacing: pt somados a cada caractere (code point), inclusive o último, como o browser. */
export const spacingOf = (text: string, letterSpacing: Pt): Pt => (letterSpacing === 0 ? 0 : letterSpacing * [...text].length);
