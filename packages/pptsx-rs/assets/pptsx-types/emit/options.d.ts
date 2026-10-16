import type * as Pptx from './pptx.ts';
import type { LineBreaks, PositionedImage, PositionedShape, PositionedSlide, PositionedText, Rect, ShapeKind } from '../core/types.ts';
import { type LineSpacingStrategy } from './calibration.ts';
import { hexOf } from './runs.ts';
/**
 * Funções puras: nó posicionado → opções do pptxgenjs. Nenhuma toca a
 * instância do pptx, então são testáveis isoladamente. Aqui fica o conteúdo
 * de cada nó (texto, imagem, shape); a pintura CSS da caixa (fundo, bordas,
 * sombra, opacidade, rotação) fica em decoration.ts.
 */
export interface InchPosition {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}
export interface ShapeSpec {
    readonly shape: Pptx.ShapeName;
    readonly options: Pptx.ShapeProps;
}
export interface TextSpec {
    readonly runs: Pptx.TextProps[];
    readonly options: Pptx.TextPropsOptions;
}
export { hexOf };
export declare const positionOf: (frame: Rect) => InchPosition;
/**
 * pptxgenjs v4 interpreta rectRadius em POLEGADAS (adj = r·EMU·100000 / min(w,h)),
 * apesar do .d.ts dizer 0–1. Limitamos a metade do menor lado, que é o máximo
 * geométrico do roundRect.
 */
export declare const rectRadiusOf: (radius: number, frame: Rect) => number;
/**
 * Geometria do prstGeom: `roundRect` leva o raio do autor; `pill` é um roundRect com raio = metade
 * do menor lado (adj 50000). As demais kinds saem sem avLst (os ajustes padrão do OOXML).
 */
export declare const geometryOf: (kind: ShapeKind, radius: number | undefined, frame: Rect) => {
    readonly shape: Pptx.ShapeName;
    readonly rectRadius?: number;
};
/** Shape 'line' usa o próprio frame: pptxgenjs desenha da quina sup. esq. à inf. dir. (flip espelha). */
export declare const shapeOf: (node: PositionedShape) => ShapeSpec;
export declare const textOf: (node: PositionedText, lineSpacing?: LineSpacingStrategy, lang?: string, lineBreaks?: LineBreaks) => TextSpec;
/**
 * Com sizing, o pptxgenjs usa w/h só como proporção da imagem original
 * (e trata número ≥ 100 como EMU), então passamos a proporção intrínseca
 * escalada para a largura do frame; o tamanho final vem de sizing.
 */
export declare const imageOf: (node: PositionedImage, baseDir: string) => Pptx.ImageProps;
/** M12: PNG do ícone raster como `data:` na área desenhada. */
export declare const iconImageOf: (png: Buffer, rect: Rect) => Pptx.ImageProps;
export declare const debugOutlineOf: (frame: Rect) => ShapeSpec;
export declare const backgroundOf: (slide: PositionedSlide, baseDir: string) => Pptx.BackgroundProps | undefined;
