import type { Color, ImageFit, PositionedImage, PositionedShape, PositionedText, Pt, Rect, ShapeKind, StrokeProps, TextAlign } from '../core/types.ts';
import { type Attrs } from './xml.ts';
export declare const rectAttrs: (frame: Rect) => Attrs;
/** Mesmo limite do emit: raio no máximo metade do menor lado. */
export declare const cornerRadiusOf: (radius: Pt | undefined, frame: Rect) => Pt;
/** Desenho do contorno de uma kind no frame (sem flip, traço ou setas). */
export declare const shapeOutlineSvg: (kind: ShapeKind, frame: Rect, props: StrokeProps & {
    readonly radius?: Pt;
}) => string;
/**
 * M12: uma kind (não rect) desenhada com atributos prontos — fundo, borda ou contorno de um Box
 * com `shape`. `part` escolhe o contorno preenchido ou o traço próprio (cilindro, colchetes).
 */
export declare const kindSvg: (kind: ShapeKind, frame: Rect, attrs: Attrs, part: 'fill' | 'stroke') => string;
export declare const shapeSvg: (node: PositionedShape) => string;
export declare const ANCHORS: Readonly<Record<TextAlign, {
    readonly anchor: string;
    readonly offset: number;
}>>;
export interface TextSvgOptions {
    readonly fontFamilyMap?: Readonly<Record<string, string>>;
}
/**
 * Um <text> por linha já quebrada: o SVG nunca decide quebra sozinho. `node.frame` é a área
 * onde as linhas ficam (o chamador passa a área de conteúdo). A decoração vai só nos tspans,
 * como nos runs do PPTX; `letterSpacing` vira `letter-spacing` (o `charSpacing` do run).
 */
export declare const textSvg: (node: PositionedText, options?: TextSvgOptions) => string;
/** cover recorta pelo frame; clipId precisa ser único no documento. */
export declare const imageElementSvg: (frame: Rect, href: string, fit: ImageFit, clipId: string) => string;
export declare const imageSvg: (node: PositionedImage, href: string, clipId: string) => string;
export declare const backgroundColorSvg: (frame: Rect, color: Color) => string;
/**
 * Faixa do texto abaixo do frame quando a altura medida passa da caixa (mesma tolerância do fit).
 * Com fonte ausente a medição é estimada: o realce seria ruído (o JSON também suprime o estouro).
 */
export declare const textOverflowRectOf: (node: PositionedText) => Rect | undefined;
/**
 * nowrap: parte da linha que passa da largura disponível (o frame cortado pela área de
 * conteúdo do pai, como no fit). Numa row o minWidth alarga o frame até a linha, então
 * comparar só com o frame esconderia o estouro.
 */
export declare const textWidthOverflowRectOf: (node: PositionedText, available?: Pt) => Rect | undefined;
/** Faixas estouradas (translúcidas, contorno sólido) + caixa do texto em contorno sólido. */
export declare const textOverflowSvg: (frame: Rect, bands: Rect | readonly Rect[]) => string;
export declare const debugOutlineSvg: (frame: Rect) => string;
/** Faixas do filho que ficam fora do pai (até 4 retângulos sem sobreposição). */
export declare const overflowRectsOf: (child: Rect, parent: Rect) => readonly Rect[];
export declare const overflowSvg: (rect: Rect) => string;
