import type { Handler } from './draft.ts';
/**
 * `outline` do CSS: contorno que não ocupa espaço (mesmo destino do alias `stroke`). O PPTX só
 * tem linha sólida; sem estilo escrito vale sólido (o autor que escreve outline quer vê-lo).
 */
export interface OutlinePart {
    readonly color?: string;
    readonly width?: number;
}
/** `'1px solid #ccc'`, número (largura) ou `'none'`; o `reason` acompanha o que não sai igual. */
export declare const parseOutline: (value: unknown) => {
    readonly part: OutlinePart | 'none';
    readonly reason?: string;
} | undefined;
export declare const OUTLINE_HANDLERS: Readonly<Record<string, Handler>>;
