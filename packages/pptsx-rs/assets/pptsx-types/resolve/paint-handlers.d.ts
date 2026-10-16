import type { Draft, Handler } from './draft.ts';
/** Handlers de pintura: raio, fundo, sombra, opacidade, transformações, camadas, overflow. */
/** Cor ilegível é erro (InvalidPropError), não diagnóstico: emissor e preview divergiriam. */
export declare const colorHandler: (apply: (draft: Draft, hex: string, alpha: number) => Draft) => Handler;
export declare const backgroundColor: Handler;
export declare const borderRadius: Handler;
export declare const PAINT_HANDLERS: Readonly<Record<string, Handler>>;
