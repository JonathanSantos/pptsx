import type { Diagnostic, PositionedTable } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import type { DiagnosticContext } from './diagnostics.ts';
import type { ShrinkPlan } from './pass.ts';
export declare const tableDiagnostics: (table: PositionedTable, plan: ShrinkPlan, overflow: Overflow | undefined, ctx: DiagnosticContext) => readonly Diagnostic[];
