import type { PositionedConnector, Rect } from '../core/types.ts';
import { type ShapeSpec, type TextSpec } from './options.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import type { LineBreaks } from '../core/types.ts';
export declare const boundsOfPoints: (points: PositionedConnector['points']) => Rect;
/** A linha (ou polilinha) do conector; 2 pontos sempre saem como `line`. */
export declare const connectorShapeOf: (connector: PositionedConnector) => ShapeSpec;
export interface ConnectorLabelSpec {
    readonly background?: ShapeSpec;
    readonly text: TextSpec;
}
export declare const connectorLabelOf: (connector: PositionedConnector, lineSpacing?: LineSpacingStrategy, lang?: string, lineBreaks?: LineBreaks) => ConnectorLabelSpec | undefined;
