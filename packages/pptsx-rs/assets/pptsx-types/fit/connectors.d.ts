import type { ConnectorSide, Diagnostic, LayoutEnv, PositionedConnector, PositionedSlide, Pt, Rect, ResolvedConnector, Side } from '../core/types.ts';
import type { DiagnosticContext } from './diagnostics.ts';
/**
 * Conectores (M12-5): etapa pós-layout, depois do ajuste de cada parte do slide. Não participam
 * do layout nem do fit: ligam os border-boxes (sem rotação) pelos lados escolhidos. Puro.
 */
interface Point {
    readonly x: Pt;
    readonly y: Pt;
}
/** Ponto médio do lado do frame. */
export declare const anchorOf: (frame: Rect, side: Side) => Point;
/** `auto` escolhe, entre os lados permitidos, o par de âncoras mais próximo (o primeiro em empate). */
export declare const sidesOf: (from: Rect, to: Rect, fromSide?: ConnectorSide, toSide?: ConnectorSide) => readonly [Side, Side];
/** Remove pontos repetidos e os do meio de trechos colineares (cotovelo alinhado vira reta). */
export declare const simplify: (points: readonly Point[]) => readonly Point[];
/**
 * Cotovelo: lados no mesmo eixo = 3 segmentos com a dobra no meio desse eixo (lados iguais: a
 * dobra sai para fora dos nós); eixos mistos = um L que sai pelo lado de `from`.
 */
export declare const elbowOf: (a: Point, b: Point, fromSide: Side, toSide: Side) => readonly Point[];
export declare const routeOf: (connector: Pick<ResolvedConnector, 'props'>, from: Rect, to: Rect) => readonly Point[];
/** Meio do segmento mais longo (o primeiro em empate): onde o rótulo fica. */
export declare const labelAnchorOf: (points: readonly Point[]) => Point;
/** id → frame dos nós desta parte do slide. */
export declare const framesById: (slide: PositionedSlide) => ReadonlyMap<string, Rect>;
export interface RoutedConnectors {
    readonly connectors: readonly PositionedConnector[];
    readonly diagnostics: readonly Diagnostic[];
}
export interface RouteInput {
    readonly slide: PositionedSlide;
    readonly connectors: readonly ResolvedConnector[];
    readonly env: LayoutEnv;
    readonly ctx: DiagnosticContext;
    /** Ids do slide do autor inteiro (todas as partes): a mensagem de id ausente lista estes. */
    readonly knownIds: Iterable<string>;
    /** Só a 1ª parte reporta id ausente (as demais repetiriam o mesmo erro). */
    readonly firstPart: boolean;
}
/**
 * Conectores de uma parte: desenhados quando as duas pontas estão nela; id ausente → error (só na
 * 1ª parte); pontas em partes diferentes → info na parte que tem `from`.
 */
export declare const routeConnectors: ({ slide, connectors, env, ctx, knownIds, firstPart }: RouteInput) => RoutedConnectors;
export {};
