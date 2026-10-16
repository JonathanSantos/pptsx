import type * as Pptx from './pptx.ts';
import type { BorderSide, CssStyle, PositionedNode, Rect, Shadow, ShapeKind, Side } from '../core/types.ts';
import { type ShapeSpec } from './options.ts';
import { type LineEnds } from './line-style.ts';
import { type PaintItem, type Rotation } from './paint.ts';
/** 0..100 do PPTX a partir de alpha × opacidade herdada. */
export declare const transparencyOf: (alpha: number, opacity: number) => number;
/** Posição em polegadas + rotação herdada (o PPTX gira cada forma em torno do próprio centro). */
export declare const placedOf: (rect: Rect, rotations: readonly Rotation[]) => {
    x: number;
    y: number;
    w: number;
    h: number;
    rotate?: number | undefined;
};
/** Borda igual nos quatro lados (e visível): vira a linha do próprio shape. */
export declare const uniformBorderOf: (css: CssStyle) => BorderSide | undefined;
/** Lados com borda visível, na ordem top, right, bottom, left. */
export declare const visibleSidesOf: (css: CssStyle) => readonly Side[];
export declare const insetRect: (frame: Rect, amount: number) => Rect;
/** O raio da linha recuada: o canto externo continua com `borderRadius`. */
export declare const insetRadiusOf: (radius: number | undefined, border: BorderSide) => number | undefined;
/** Imagem de fundo só em caixa; numa Image o `src` já é o conteúdo. */
export declare const hasBackgroundImage: (node: PositionedNode) => boolean;
export declare const shadowOf: (shadow: Shadow, opacity: number) => Pptx.ShadowProps;
/**
 * M12: kind do fundo da caixa. Sem `shape` (ou 'rect') vale o raio, como antes; 'roundRect' usa o
 * raio do autor ou o arredondamento padrão do preset; as demais ignoram o raio (css-not-emitted).
 */
export declare const boxShapeOf: (node: PositionedNode) => ShapeKind;
/** Extremos da linha de um lado: centrada na faixa da borda, dentro do border-box. */
export declare const sideSegmentOf: (frame: Rect, side: Side, width: number) => Rect;
export interface Decoration {
    /** Formas antes do conteúdo e da imagem de fundo (fundo, sombra). */
    readonly under: readonly ShapeSpec[];
    /** Formas depois da imagem de fundo (bordas, contorno). */
    readonly over: readonly ShapeSpec[];
}
/** M12: nós vetoriais (Path, Icon) não pintam caixa (fundo, borda, contorno). */
export declare const hasBoxDecoration: (node: PositionedNode) => boolean;
/**
 * Fundo + borda uniforme = uma forma (fill + linha recuada). Bordas diferentes por lado = fundo
 * sem linha + uma linha por lado. Com imagem de fundo, as bordas vão por cima dela. Só contorno
 * (o `fill`/`stroke` antigos) = uma forma, como a engine emitia.
 */
export declare const decorationOf: (node: PositionedNode, item: PaintItem) => Decoration;
/** Imagem de fundo da caixa (cover), entre o fundo e as bordas. */
export declare const backgroundImageOf: (node: PositionedNode, item: PaintItem, baseDir: string) => Pptx.ImageProps | undefined;
/** `letterSpacing` → `charSpacing` e opacidade herdada em cada run (o PPTX não tem opacidade de caixa de texto). */
export declare const paintedRunsOf: (runs: readonly Pptx.TextProps[], css: CssStyle, opacity: number) => Pptx.TextProps[];
/** Imagem de conteúdo girada e translúcida (a posição continua a do `imageOf`, pelo `sizing`). */
export declare const paintedImageOf: (image: Pptx.ImageProps, content: Rect, item: PaintItem) => Pptx.ImageProps;
/** Shape: geometria da engine (options.ts) com posição girada, opacidade, sombra e a marca de cap/join. */
export declare const paintedShapeOf: (spec: ShapeSpec, node: PositionedNode, item: PaintItem, ends?: LineEnds) => ShapeSpec;
