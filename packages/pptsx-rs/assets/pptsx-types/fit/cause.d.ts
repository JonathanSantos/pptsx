import type { Diagnostic, PositionedSlide, Pt } from '../core/types.ts';
import type { Overflow } from './detect.ts';
export interface Cause {
    readonly path: string;
    /** Quanto (pt) a causa quer a mais do que a área deu. */
    readonly demand: Pt;
}
/**
 * Causa de cada contêiner em fluxo que tem algum estouro text/box entre os descendentes.
 * Row não aponta causa: filhos lado a lado não tiram altura uns dos outros (por isso a
 * demanda dela é a maior, não a soma). Sem essa exceção, N cartões iguais numa row
 * culpariam o primeiro cartão pelo estouro dos outros.
 */
export declare const causesOf: (slide: PositionedSlide, overflows: readonly Overflow[]) => ReadonlyMap<string, Cause>;
/**
 * Causa por largura: numa row, um Text nowrap que passa da largura toma o espaço dos
 * irmãos (o minWidth dele espreme os outros até 0 pt e os empurra para fora). Os estouros
 * dos irmãos e o box-overflow da row são consequência; vence o nowrap de maior estouro.
 */
export interface WidthCause {
    readonly path: string;
    readonly overflowPt: Pt;
    /** Irmãos em fluxo (sem a causa): os estouros dentro deles são consequência. */
    readonly siblings: readonly string[];
}
export declare const widthCausesOf: (slide: PositionedSlide, overflows: readonly Overflow[]) => ReadonlyMap<string, WidthCause>;
export declare const attributeCauses: (diagnostics: readonly Diagnostic[], slide: PositionedSlide, overflows: readonly Overflow[]) => readonly Diagnostic[];
