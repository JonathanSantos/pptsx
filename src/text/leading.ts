import { DEFAULTS } from '../core/defaults.ts';
import type { LineRun, Pt, TextRun, TextStyle } from '../core/types.ts';

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
export const runSizeOf = (run: Pick<TextRun, 'verticalAlign' | 'size'> | undefined, size: Pt): Pt => {
  const own = run?.size ?? size;
  return run?.verticalAlign === 'super' || run?.verticalAlign === 'sub' ? own * DEFAULTS.text.superscriptRatio : own;
};

/** M13-7: algum run muda corpo ou família → as linhas podem ter alturas diferentes. */
export const hasRunMetrics = (runs: readonly Pick<TextRun, 'size' | 'family'>[]): boolean =>
  runs.some((run) => run.size !== undefined || run.family !== undefined);

export interface LineBoxes {
  readonly lineHeights: readonly Pt[];
  readonly ascents: readonly Pt[];
}

/**
 * M13-7: line box do CSS sem strut (como o PowerPoint): a linha vai da maior ascendente à maior
 * descendente (altura − ascendente) dos runs que caem nela; linha vazia usa a caixa do Text.
 */
export const lineBoxesOf = (lineRuns: readonly (readonly LineRun[])[], runBoxes: readonly LineBox[], base: LineBox): LineBoxes => {
  const boxes = lineRuns.map((pieces) => {
    const own = [...new Set(pieces.map((piece) => piece.run))].map((run) => runBoxes[run] ?? base);
    const used = own.length === 0 ? [base] : own;
    const ascent = Math.max(...used.map((box) => box.ascent));
    const descent = Math.max(...used.map((box) => box.lineHeight - box.ascent));
    return { lineHeight: ascent + descent, ascent };
  });
  return { lineHeights: boxes.map((box) => box.lineHeight), ascents: boxes.map((box) => box.ascent) };
};

/** CSS letter-spacing: pt somados a cada caractere (code point), inclusive o último, como o browser. */
export const spacingOf = (text: string, letterSpacing: Pt): Pt => (letterSpacing === 0 ? 0 : letterSpacing * [...text].length);

/** Layout com as alturas por linha: `lineHeight`/`ascent` da 1ª linha e `height` = soma. */
export const withLineBoxes = <L extends { readonly lineHeight: Pt; readonly ascent: Pt; readonly height: Pt }>(layout: L, boxes: LineBoxes): L & LineBoxes => ({
  ...layout,
  lineHeight: boxes.lineHeights[0] ?? layout.lineHeight,
  ascent: boxes.ascents[0] ?? layout.ascent,
  height: boxes.lineHeights.reduce((sum, height) => sum + height, 0),
  lineHeights: boxes.lineHeights,
  ascents: boxes.ascents,
});
