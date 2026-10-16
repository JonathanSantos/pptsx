import * as fontkit from 'fontkit';
import type { FontFace, FontWeight } from '../core/types.ts';
export interface FaceMatch {
    readonly font: fontkit.Font;
    /** Peso numérico da face registrada. */
    readonly weight: number;
    readonly italic: boolean;
}
export interface FontRegistry {
    readonly faces: readonly FontFace[];
    /** Face escolhida pela correspondência do CSS (itálico, depois peso); undefined = família sem face. */
    readonly get: (family: string, weight: FontWeight, italic: boolean) => fontkit.Font | undefined;
    /** M13: a mesma escolha, com o peso e o itálico da face usada. */
    readonly match: (family: string, weight: FontWeight, italic: boolean) => FaceMatch | undefined;
}
/**
 * Ordem de preferência dos pesos disponíveis para um pedido (CSS Fonts §5.2, font-weight):
 * 400–500: o pedido, depois o resto da faixa até 500, depois abaixo (descendo), depois acima;
 * < 400: o pedido e abaixo (descendo), depois acima (subindo); > 500: o pedido e acima, depois abaixo.
 */
export declare const weightPreference: (available: readonly number[], wanted: number) => readonly number[];
/** Carrega cada arquivo uma única vez (IO na borda); `get`/`match` são só consulta em memória. */
export declare const createFontRegistry: (faces: readonly FontFace[]) => FontRegistry;
