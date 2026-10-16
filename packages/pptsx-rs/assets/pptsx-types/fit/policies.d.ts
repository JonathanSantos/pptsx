import type { Diagnostic, FitPolicy, PositionedText, Pt } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import type { DiagnosticContext } from './diagnostics.ts';
import type { TextPatch } from './rewrite.ts';
/** Estado final de um Text, visto pela política que o governa. */
export interface TextOutcome {
    readonly text: PositionedText;
    /** Estouro de altura. */
    readonly overflow: Overflow | undefined;
    /** Estouro de largura (só Text com nowrap); pode coexistir com o de altura. */
    readonly widthOverflow: Overflow | undefined;
    /** size original do autor */
    readonly from: Pt;
    /** size final */
    readonly to: Pt;
    readonly min: Pt;
}
/** Strategy por `fit`. */
export interface OverflowPolicy {
    /** Text estourado (ou com palavra partida) com esta política dispara a busca de shrink no seu escopo. */
    readonly triggersShrink: boolean;
    /** Size do Text quando o escopo desce `delta` passos a partir do size do autor; undefined = não encolhe. */
    readonly resize: (from: Pt, min: Pt, delta: number) => Pt | undefined;
    /** Ajuste único depois do loop (antes do relayout final). */
    readonly settle: (text: PositionedText, overflow: Overflow | undefined) => TextPatch | undefined;
    /** Diagnóstico de overflow/ajuste no fim (truncamento e fonte são comuns a todas). */
    readonly diagnose: (outcome: TextOutcome, ctx: DiagnosticContext) => readonly Diagnostic[];
}
export declare const POLICIES: Readonly<Record<FitPolicy, OverflowPolicy>>;
