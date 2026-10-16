import type { Diagnostic, PositionedNode } from '../core/types.ts';
import type { DiagnosticContext } from './diagnostics.ts';
export declare const vectorDiagnosticsOf: (nodes: readonly PositionedNode[], ctx: DiagnosticContext) => readonly Diagnostic[];
