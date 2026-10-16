import type { LineCap, LineJoin, LineStyle } from '../core/types.ts';
import type * as Pptx from './pptx.ts';
/** `dashType` só quando não é sólido (o padrão do PPTX). */
export declare const dashOf: (style: LineStyle | undefined) => {
    readonly dashType?: Pptx.ShapeLineProps['dashType'];
};
export interface LineEnds {
    readonly cap?: LineCap;
    readonly join?: LineJoin;
}
/** objectName com a marca; undefined quando cap e join são os padrões do PPTX (flat, miter). */
export declare const lineMarkerOf: ({ cap, join }: LineEnds, index: number) => {
    readonly objectName?: string;
};
/** Aplica as marcas de cap/join de um slide inteiro; shapes sem marca ficam intactos. */
export declare const applyLineMarkers: (xml: string) => string;
