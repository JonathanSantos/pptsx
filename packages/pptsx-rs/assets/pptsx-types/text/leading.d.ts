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
export declare const lineBoxOf: (natural: LineBox, size: Pt, lineHeight: TextStyle['lineHeight']) => LineBox;
/**
 * M13: corpo em que um run é desenhado: sobrescrito/subscrito a `superscriptRatio` do corpo (o
 * renderizador reduz sozinho); a altura da linha continua a do corpo do Text.
 */
export declare const runSizeOf: (run: Pick<TextRun, 'verticalAlign' | 'size'> | undefined, size: Pt) => Pt;
/** M13-7: algum run muda corpo ou família → as linhas podem ter alturas diferentes. */
export declare const hasRunMetrics: (runs: readonly Pick<TextRun, 'size' | 'family'>[]) => boolean;
export interface LineBoxes {
    readonly lineHeights: readonly Pt[];
    readonly ascents: readonly Pt[];
}
/**
 * M13-7: line box do CSS sem strut (como o PowerPoint): a linha vai da maior ascendente à maior
 * descendente (altura − ascendente) dos runs que caem nela; linha vazia usa a caixa do Text.
 */
export declare const lineBoxesOf: (lineRuns: readonly (readonly LineRun[])[], runBoxes: readonly LineBox[], base: LineBox) => LineBoxes;
/** CSS letter-spacing: pt somados a cada caractere (code point), inclusive o último, como o browser. */
export declare const spacingOf: (text: string, letterSpacing: Pt) => Pt;
/** Layout com as alturas por linha: `lineHeight`/`ascent` da 1ª linha e `height` = soma. */
export declare const withLineBoxes: <L extends {
    readonly lineHeight: Pt;
    readonly ascent: Pt;
    readonly height: Pt;
}>(layout: L, boxes: LineBoxes) => L & LineBoxes;
