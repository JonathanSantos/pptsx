import type { Rect, ShapeKind } from '../core/types.ts';
/**
 * Geometria das formas preset no preview (M12-2): as fórmulas do `presetShapeDefinitions.xml`
 * do OOXML com os mesmos `adj` que o PPTX usa por padrão (DEFAULTS.shape.pptx), para o PNG
 * bater com o Keynote/PowerPoint. Puro: frame → `d` do SVG em coordenadas do slide.
 * rect, roundRect, ellipse e line continuam com elementos próprios em svg.ts.
 */
export interface ShapeGeometry {
    /** Contorno preenchido (fill e, quando `stroke` é ausente, também o traço). */
    readonly fill: string;
    /** Traço próprio quando difere do contorno (cilindro, colchetes); ausente = o do fill. */
    readonly stroke?: string;
    /** Face com `fill="lighten"` no OOXML (tampa do cilindro), pintada mais clara por cima do fill. */
    readonly lighten?: string;
}
/** Kinds com desenho próprio aqui (as demais são rect/roundRect/pill/ellipse/line em svg.ts). */
export declare const hasPresetGeometry: (kind: ShapeKind) => boolean;
/** Geometria de uma kind preset no frame; undefined para as que svg.ts desenha com elemento próprio. */
export declare const shapeGeometryOf: (kind: ShapeKind, frame: Rect) => ShapeGeometry | undefined;
