import { DEFAULTS } from '../core/defaults.ts';
import type { Diagnostic, FitPolicy, PositionedText, Pt } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import { textOverflowKept, textOverflowShrunk, textOverflowTruncated, textShrunk } from './diagnostics.ts';
import type { DiagnosticContext } from './diagnostics.ts';
import type { TextPatch } from './rewrite.ts';

/** Estado final de um Text, visto pela política que o governa. */
export interface TextOutcome {
  readonly text: PositionedText;
  readonly overflow: Overflow | undefined;
  /** size original do autor */
  readonly from: Pt;
  /** size final */
  readonly to: Pt;
  readonly min: Pt;
  readonly maxSteps: number;
}

/** Strategy por `fit`. */
export interface OverflowPolicy {
  /** Text estourado com esta política dispara um passo de shrink no seu escopo. */
  readonly triggersShrink: boolean;
  /** Novo size num passo do loop; undefined = não age neste passo. */
  readonly step: (current: Pt, min: Pt) => Pt | undefined;
  /** Ajuste único depois do loop (antes do relayout final). */
  readonly settle: (text: PositionedText, overflow: Overflow | undefined) => TextPatch | undefined;
  /** Diagnóstico de overflow/ajuste no fim (truncamento e fonte são comuns a todas). */
  readonly diagnose: (outcome: TextOutcome, ctx: DiagnosticContext) => readonly Diagnostic[];
}

const never = () => undefined;

const shrink: OverflowPolicy = {
  triggersShrink: true,
  step: (current, min) => (current > min ? Math.max(min, current - DEFAULTS.fit.shrinkStep) : undefined),
  settle: never,
  diagnose: (outcome, ctx) => {
    if (outcome.overflow !== undefined) return [textOverflowShrunk(ctx, outcome.overflow, outcome)];
    return outcome.to < outcome.from ? [textShrunk(ctx, outcome.text.path, outcome.from, outcome.to)] : [];
  },
};

/**
 * Linhas inteiras que cabem na altura disponível (pelo menos uma); respeita um
 * maxLines menor do autor. Disponível = altura do texto − estouro detectado.
 */
const linesThatFit = (text: PositionedText, overflow: Overflow): number => {
  const available = text.text.height - overflow.overflowPt;
  const fit = Math.max(1, Math.floor(available / text.text.lineHeight));
  return Math.min(fit, text.props.maxLines ?? fit);
};

const truncate: OverflowPolicy = {
  triggersShrink: false,
  step: never,
  settle: (text, overflow) => (overflow === undefined ? undefined : { maxLines: linesThatFit(text, overflow) }),
  diagnose: (outcome, ctx) => (outcome.overflow === undefined ? [] : [textOverflowTruncated(ctx, outcome.overflow)]),
};

const error: OverflowPolicy = {
  triggersShrink: false,
  step: never,
  settle: never,
  diagnose: (outcome, ctx) => (outcome.overflow === undefined ? [] : [textOverflowKept(ctx, outcome.overflow, outcome.to)]),
};

export const POLICIES: Readonly<Record<FitPolicy, OverflowPolicy>> = { shrink, truncate, error };
