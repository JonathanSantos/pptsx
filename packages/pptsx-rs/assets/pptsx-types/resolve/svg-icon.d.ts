import type { IconContent, Rect } from '../core/types.ts';
/**
 * Leitura e classificação de um ícone SVG (M12-4). Puro: recebe o texto do arquivo. Conservador:
 * vira vetor só o que tem de/para exato no custGeom (formas simples com cores sólidas, sem
 * transformação, opacidade, máscara, gradiente, texto…); na dúvida, raster com o motivo.
 */
export interface IconOptions {
    /** Cor que substitui currentColor (e preto, com recolor). */
    readonly color: string;
    readonly recolor: boolean;
}
export interface ReadIcon {
    readonly viewBox: Rect;
    readonly content: IconContent;
}
/** SVG para o raster: currentColor (e, com recolor, preto) já trocados pela cor do ícone. */
export declare const recoloredSvg: (svg: string, options: IconOptions) => string;
/** Lê o SVG; `forceImage` pula a classificação (render="image"). */
export declare const readIcon: (svg: string, options: IconOptions, forceImage?: boolean) => ReadIcon;
