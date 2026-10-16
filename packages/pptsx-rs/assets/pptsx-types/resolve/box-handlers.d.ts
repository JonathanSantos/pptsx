import type { Side } from '../core/types.ts';
import type { Handler } from './draft.ts';
/** Handlers do box model: posição, tamanhos, flex, espaçamentos, bordas e grid. */
export declare const SIDES: readonly Side[];
export declare const BOX_HANDLERS: Readonly<Record<string, Handler>>;
