import type * as Pptx from './pptx.ts';
import type { LineBreaks, PositionedConnector, Rect } from '../core/types.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import type { PaintItem } from './paint.ts';
export interface EmitContext {
    readonly baseDir: string;
    readonly lineSpacing?: LineSpacingStrategy;
    readonly lang?: string;
    readonly lineBreaks?: LineBreaks;
}
export declare const emitItem: (slide: Pptx.Slide, item: PaintItem, ctx: EmitContext) => void;
/** M12: conectores por cima de todos os nós, na ordem em que foram declarados. */
export declare const emitConnector: (slide: Pptx.Slide, connector: PositionedConnector, ctx: EmitContext) => void;
/** Frames de Box/Text/Image/Chart/Table na ordem de pintura, para o contorno de debug. */
export declare const debugFramesOf: (items: readonly PaintItem[]) => readonly Rect[];
export declare const emitDebugOutlines: (slide: Pptx.Slide, items: readonly PaintItem[]) => void;
