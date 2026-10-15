import { DEFAULTS } from '../core/defaults.ts';
import type { Diagnostic, FitPolicy, PositionedText, Pt } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import {
  textIllegible,
  textOverflowKept,
  textOverflowShrunk,
  textOverflowTruncated,
  textOverflowWidthKept,
  textOverflowWidthShrunk,
  textShrunk,
  withZeroArea,
} from './diagnostics.ts';
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

const never = () => undefined;

/** Altura que o Text tinha de fato: a medida menos o que passou. */
const availableOf = (outcome: TextOutcome, overflow: Overflow): Pt => outcome.text.text.height - overflow.overflowPt;

const heightOverflowShrunk = (outcome: TextOutcome, ctx: DiagnosticContext): readonly Diagnostic[] =>
  outcome.overflow === undefined
    ? []
    : [withZeroArea(textOverflowShrunk(ctx, outcome.overflow, outcome), availableOf(outcome, outcome.overflow))];

const widthOverflowShrunk = (outcome: TextOutcome, ctx: DiagnosticContext): readonly Diagnostic[] =>
  outcome.widthOverflow === undefined
    ? []
    : [textOverflowWidthShrunk(ctx, outcome.widthOverflow, outcome.text.text.width, outcome)];

// text-shrunk diz que coube: com estouro em qualquer eixo, não coube.
const overflowOrShrunk = (outcome: TextOutcome, ctx: DiagnosticContext): readonly Diagnostic[] => {
  const overflows = [...heightOverflowShrunk(outcome, ctx), ...widthOverflowShrunk(outcome, ctx)];
  if (overflows.length > 0) return overflows;
  return outcome.to < outcome.from ? [textShrunk(ctx, outcome.text.path, outcome.from, outcome.to)] : [];
};

const widthKept = (outcome: TextOutcome, ctx: DiagnosticContext, policy: 'error' | 'truncate'): readonly Diagnostic[] =>
  outcome.widthOverflow === undefined
    ? []
    : [textOverflowWidthKept(ctx, outcome.widthOverflow, outcome.text.text.width, outcome.to, policy)];

// Só o que o ajuste reduziu: size do autor já abaixo do piso é escolha dele.
const isIllegible = (outcome: TextOutcome): boolean =>
  outcome.to < outcome.from && outcome.to < DEFAULTS.text.minLegibleSize;

const shrink: OverflowPolicy = {
  triggersShrink: true,
  resize: (from, min, delta) => Math.max(min, from - delta * DEFAULTS.fit.shrinkStep),
  settle: never,
  diagnose: (outcome, ctx) => [
    ...overflowOrShrunk(outcome, ctx),
    ...(isIllegible(outcome) ? [textIllegible(ctx, outcome.text.path, outcome.from, outcome.to)] : []),
  ],
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
  resize: never,
  settle: (text, overflow) => (overflow === undefined ? undefined : { maxLines: linesThatFit(text, overflow) }),
  diagnose: (outcome, ctx) => [
    ...(outcome.overflow === undefined
      ? []
      : [withZeroArea(textOverflowTruncated(ctx, outcome.overflow), availableOf(outcome, outcome.overflow))]),
    ...widthKept(outcome, ctx, 'truncate'),
  ],
};

const error: OverflowPolicy = {
  triggersShrink: false,
  resize: never,
  settle: never,
  diagnose: (outcome, ctx) => [
    ...(outcome.overflow === undefined
      ? []
      : [withZeroArea(textOverflowKept(ctx, outcome.overflow, outcome.to), availableOf(outcome, outcome.overflow))]),
    ...widthKept(outcome, ctx, 'error'),
  ],
};

export const POLICIES: Readonly<Record<FitPolicy, OverflowPolicy>> = { shrink, truncate, error };
