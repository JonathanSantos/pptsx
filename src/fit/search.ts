import { DEFAULTS } from '../core/defaults.ts';
import type { Pt } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import { heightOverflowsOf, passOf, positionedShrinkables, resolvedShrinkables, widthOverflowsOf } from './pass.ts';
import type { LayoutInput, Pass, Plans, ShrinkPlan } from './pass.ts';
import { patchTexts } from './rewrite.ts';
import type { TextPatch } from './rewrite.ts';
import { isWithin, scopeOf, segmentsOf } from './scope.ts';
import { shrinkSizeOf } from './shrinkable.ts';
import type { BrokenSegment, Shrinkable } from './shrinkable.ts';

// Shrink por busca binária: cada escopo procura o menor delta (em passos de shrinkStep a
// partir do size do autor) sem gatilho. Uma tentativa = um layout completo do slide.
// Text e Table participam juntos, pela visão comum de shrinkable.ts.

const STEP = DEFAULTS.fit.shrinkStep;

// Ruído de ponto flutuante na razão de larguras: sem isto, 3.0000000001 viraria 4 passos
// e o texto desceria um passo além do necessário.
const RATIO_NOISE = 1e-9;

/** Text/Table que pode encolher neste escopo: tem política que encolhe e ainda está acima do mínimo. */
interface Participant {
  readonly path: string;
  readonly plan: ShrinkPlan;
  readonly current: Pt;
}

type WidthOverflows = ReadonlyMap<string, Overflow>;

/**
 * Falta de largura (palavra partida ou linha nowrap que não cabe) só conta enquanto o
 * próprio Text pode encolher: encolher os vizinhos não alarga a linha dele. Estouro de
 * altura conta mesmo no mínimo (vizinhos liberam altura).
 */
const isWidthTrigger = (node: Shrinkable, plan: ShrinkPlan, widths: WidthOverflows): boolean =>
  (node.broken.length > 0 || widths.has(node.path)) && node.fontSize > plan.min;

const canTrigger = (node: Shrinkable, plan: ShrinkPlan | undefined): plan is ShrinkPlan =>
  plan !== undefined && plan.policy.triggersShrink && !node.fontMissing;

// Fonte ausente não dispara: a medição é estimada e o diagnóstico é só font-missing.
const triggersOf = (pass: Pass, plans: Plans): readonly Shrinkable[] => {
  const overflows = heightOverflowsOf(pass);
  const widths = widthOverflowsOf(pass);
  return positionedShrinkables(pass).filter((node) => {
    const plan = plans.get(node.path);
    if (!canTrigger(node, plan)) return false;
    return overflows.has(node.path) || isWidthTrigger(node, plan, widths);
  });
};

const isTriggered = (pass: Pass, plans: Plans, scope: string): boolean =>
  triggersOf(pass, plans).some((node) => isWithin(node.path, scope));

const depthOf = (path: string): number => segmentsOf(path).length;

/** Escopos disparados, do mais interno ao mais externo (empate: ordem no slide). */
const triggeredScopes = (pass: Pass, plans: Plans): readonly string[] =>
  [...new Set(triggersOf(pass, plans).map((node) => scopeOf(node.path)))].sort((a, b) => depthOf(b) - depthOf(a));

const participantsOf = (pass: Pass, plans: Plans, scope: string): readonly Participant[] =>
  resolvedShrinkables(pass.resolved.children).flatMap((node) => {
    const plan = plans.get(node.path);
    const current = shrinkSizeOf(node);
    if (plan === undefined || !isWithin(node.path, scope) || current <= plan.min) return [];
    return plan.policy.resize(plan.from, plan.min, 0) === undefined ? [] : [{ path: node.path, plan, current }];
  });

/** Passos até o mínimo do nó mais longe dele: com esse delta todo o escopo está no mínimo. */
const maxDeltaOf = (participants: readonly Participant[]): number =>
  Math.max(...participants.map(({ plan }) => Math.ceil((plan.from - plan.min) / STEP)));

/** Maior delta que ainda deixa todos como estão (o estado atual, que sabemos disparar). */
const untouchedDeltaOf = (participants: readonly Participant[]): number =>
  Math.min(...participants.map(({ plan, current }) => Math.floor((plan.from - current) / STEP)));

/** Passos a partir do size do autor até o size em que a largura `fitting` cabe. */
const deltaTo = (plan: ShrinkPlan, fitting: Pt): number => Math.ceil((plan.from - fitting) / STEP - RATIO_NOISE);

/**
 * Piso pela palavra partida: a largura escala com o size, então o size em que o maior
 * segmento cabe na largura de quebra sai de uma regra de três. Qualquer delta menor
 * ainda parte a palavra; a busca começa direto ali.
 */
const brokenDeltaOf = (fontSize: Pt, plan: ShrinkPlan, segment: BrokenSegment): number =>
  segment.widest <= 0 ? 0 : deltaTo(plan, (fontSize * segment.breakWidth) / segment.widest);

/** Na Table cada célula partida pede o seu piso: vale o maior (todas com o mesmo size). */
const segmentDeltaOf = (node: Shrinkable, plan: ShrinkPlan): number =>
  Math.max(0, ...node.broken.map((segment) => brokenDeltaOf(node.fontSize, plan, segment)));

/**
 * nowrap: o segmento indivisível é a linha inteira e ela não quebra, então a regra de
 * três é sobre a largura da linha contra a área (sem textSafety: não há quebra a proteger;
 * a tolerância da detecção entra na área).
 */
const lineDeltaOf = (node: Shrinkable, plan: ShrinkPlan, overflow: Overflow | undefined): number => {
  if (overflow === undefined || node.lineWidth <= 0) return 0;
  const area = node.lineWidth - overflow.overflowPt + DEFAULTS.fit.epsilon;
  return deltaTo(plan, (node.fontSize * area) / node.lineWidth);
};

const wordDeltaOf = (node: Shrinkable, plan: ShrinkPlan, widths: WidthOverflows): number =>
  Math.max(segmentDeltaOf(node, plan), lineDeltaOf(node, plan, widths.get(node.path)));

const wordTriggersIn = (pass: Pass, plans: Plans, scope: string): readonly (readonly [Shrinkable, ShrinkPlan])[] => {
  const widths = widthOverflowsOf(pass);
  return positionedShrinkables(pass).flatMap((node) => {
    const plan = plans.get(node.path);
    if (!isWithin(node.path, scope) || !canTrigger(node, plan)) return [];
    return isWidthTrigger(node, plan, widths) ? [[node, plan] as const] : [];
  });
};

const wordFloorOf = (pass: Pass, plans: Plans, scope: string): number => {
  const widths = widthOverflowsOf(pass);
  return Math.max(0, ...wordTriggersIn(pass, plans, scope).map(([node, plan]) => wordDeltaOf(node, plan, widths)));
};

/**
 * Cada Text/Table sem largura (palavra partida ou linha nowrap) vai sozinho ao size em que
 * ela cabe (ou ao seu mínimo). Só ele: os vizinhos não alargam a linha dele, e um delta comum
 * arrastaria rótulos pequenos ao mínimo por causa de um valor grande que não cabe.
 */
const wordPatchesOf = (pass: Pass, plans: Plans, scope: string): ReadonlyMap<string, TextPatch> => {
  const widths = widthOverflowsOf(pass);
  return new Map(
    wordTriggersIn(pass, plans, scope).flatMap(([node, plan]) => {
      const current = node.fontSize;
      const size = Math.min(current, plan.policy.resize(plan.from, plan.min, wordDeltaOf(node, plan, widths)) ?? current);
      return size < current ? [[node.path, { size }] as const] : [];
    }),
  );
};

// Nunca aumenta: escopos internos já resolvidos nesta rodada ficam como estão se o delta de fora for menor.
const patchesAt = (participants: readonly Participant[], delta: number): ReadonlyMap<string, TextPatch> =>
  new Map(
    participants.flatMap(({ path, plan, current }) => {
      const size = Math.min(current, plan.policy.resize(plan.from, plan.min, delta) ?? current);
      return size < current ? [[path, { size }] as const] : [];
    }),
  );

interface Search {
  readonly pass: Pass;
  readonly plans: Plans;
  readonly scope: string;
  readonly participants: readonly Participant[];
  readonly input: LayoutInput;
}

const attempt = (search: Search, delta: number): Pass =>
  passOf(patchTexts(search.pass.resolved, patchesAt(search.participants, delta)), search.input);

/** Menor delta sem gatilho em [low, high]; `best` é a tentativa em `high`, já sabida sem gatilho. */
const bisect = (search: Search, low: number, high: number, best: Pass): Pass => {
  if (low >= high) return best;
  const middle = Math.floor((low + high) / 2);
  const candidate = attempt(search, middle);
  return isTriggered(candidate, search.plans, search.scope)
    ? bisect(search, middle + 1, high, best)
    : bisect(search, low, middle, candidate);
};

/**
 * Bisseção comum do escopo. Tenta primeiro o delta máximo: se nem no mínimo cabe, para
 * ali (um layout só); se cabe, a tentativa vira o melhor conhecido e a bisseção nunca
 * precisa de um layout extra no fim.
 */
const bisectScope = (pass: Pass, plans: Plans, scope: string, input: LayoutInput): Pass => {
  if (!isTriggered(pass, plans, scope)) return pass;
  const participants = participantsOf(pass, plans, scope);
  if (participants.length === 0) return pass;
  const search: Search = { pass, plans, scope, participants, input };
  const high = maxDeltaOf(participants);
  const atMin = attempt(search, high);
  if (isTriggered(atMin, plans, scope)) return atMin;
  const low = Math.min(high, Math.max(untouchedDeltaOf(participants) + 1, wordFloorOf(pass, plans, scope)));
  return bisect(search, low, high, atMin);
};

/** Busca de um escopo: primeiro as palavras partidas (cada uma no seu size), depois o que a altura ainda pedir. */
const searchScope = (pass: Pass, plans: Plans, scope: string, input: LayoutInput): Pass => {
  if (!isTriggered(pass, plans, scope)) return pass;
  const words = wordPatchesOf(pass, plans, scope);
  const start = words.size === 0 ? pass : passOf(patchTexts(pass.resolved, words), input);
  return bisectScope(start, plans, scope, input);
};

/**
 * Rodadas: uma busca por escopo disparado, do mais interno ao mais externo. Repete
 * enquanto alguma busca mudou algo (sizes só descem, então termina) ou até o limite.
 */
export const shrinkRounds = (pass: Pass, plans: Plans, input: LayoutInput, remaining: number): Pass => {
  if (remaining <= 0) return pass;
  const next = triggeredScopes(pass, plans).reduce((current, scope) => searchScope(current, plans, scope, input), pass);
  return next === pass ? pass : shrinkRounds(next, plans, input, remaining - 1);
};
