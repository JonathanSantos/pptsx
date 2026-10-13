import { DEFAULTS } from '../core/defaults.ts';
import type { PositionedText, Pt } from '../core/types.ts';
import { passOf, positionedTexts, resolvedTexts, sizeOf, textOverflowsOf } from './pass.ts';
import type { LayoutInput, Pass, Plans, TextPlan } from './pass.ts';
import { patchTexts } from './rewrite.ts';
import type { TextPatch } from './rewrite.ts';
import { isWithin, scopeOf, segmentsOf } from './scope.ts';

// Shrink por busca binária: cada escopo procura o menor delta (em passos de shrinkStep a
// partir do size do autor) sem gatilho. Uma tentativa = um layout completo do slide.

const STEP = DEFAULTS.fit.shrinkStep;

// Ruído de ponto flutuante na razão de larguras: sem isto, 3.0000000001 viraria 4 passos
// e o texto desceria um passo além do necessário.
const RATIO_NOISE = 1e-9;

/** Text que pode encolher neste escopo: tem política que encolhe e ainda está acima do mínimo. */
interface Participant {
  readonly path: string;
  readonly plan: TextPlan;
  readonly current: Pt;
}

/**
 * Palavra partida só conta enquanto o próprio Text pode encolher: encolher os vizinhos
 * não alarga a linha dele. Estouro de altura conta mesmo no mínimo (vizinhos liberam altura).
 */
const isWordTrigger = (text: PositionedText, plan: TextPlan): boolean =>
  text.text.wordBroken && text.text.fontSize > plan.min;

// Fonte ausente não dispara: a medição é estimada e o diagnóstico é só font-missing.
const triggersOf = (pass: Pass, plans: Plans): readonly PositionedText[] => {
  const overflows = textOverflowsOf(pass);
  return positionedTexts(pass).filter((text) => {
    const plan = plans.get(text.path);
    if (plan === undefined || !plan.policy.triggersShrink || text.text.fontMissing) return false;
    return overflows.has(text.path) || isWordTrigger(text, plan);
  });
};

const isTriggered = (pass: Pass, plans: Plans, scope: string): boolean =>
  triggersOf(pass, plans).some((text) => isWithin(text.path, scope));

const depthOf = (path: string): number => segmentsOf(path).length;

/** Escopos disparados, do mais interno ao mais externo (empate: ordem no slide). */
const triggeredScopes = (pass: Pass, plans: Plans): readonly string[] =>
  [...new Set(triggersOf(pass, plans).map((text) => scopeOf(text.path)))].sort((a, b) => depthOf(b) - depthOf(a));

const participantsOf = (pass: Pass, plans: Plans, scope: string): readonly Participant[] =>
  resolvedTexts(pass.resolved.children).flatMap((text) => {
    const plan = plans.get(text.path);
    const current = sizeOf(text);
    if (plan === undefined || !isWithin(text.path, scope) || current <= plan.min) return [];
    return plan.policy.resize(plan.from, plan.min, 0) === undefined ? [] : [{ path: text.path, plan, current }];
  });

/** Passos até o mínimo do Text mais longe dele: com esse delta todo o escopo está no mínimo. */
const maxDeltaOf = (participants: readonly Participant[]): number =>
  Math.max(...participants.map(({ plan }) => Math.ceil((plan.from - plan.min) / STEP)));

/** Maior delta que ainda deixa todos como estão (o estado atual, que sabemos disparar). */
const untouchedDeltaOf = (participants: readonly Participant[]): number =>
  Math.min(...participants.map(({ plan, current }) => Math.floor((plan.from - current) / STEP)));

/**
 * Piso pela palavra partida: a largura escala com o size, então o size em que o maior
 * segmento cabe na largura de quebra sai de uma regra de três. Qualquer delta menor
 * ainda parte a palavra; a busca começa direto ali.
 */
const wordDeltaOf = (text: PositionedText, plan: TextPlan): number => {
  if (!text.text.wordBroken || text.text.widestSegment <= 0) return 0;
  const breakWidth = text.frame.width * DEFAULTS.textSafety;
  const fitting = (text.text.fontSize * breakWidth) / text.text.widestSegment;
  return Math.ceil((plan.from - fitting) / STEP - RATIO_NOISE);
};

const wordTriggersIn = (pass: Pass, plans: Plans, scope: string): readonly (readonly [PositionedText, TextPlan])[] =>
  positionedTexts(pass).flatMap((text) => {
    const plan = plans.get(text.path);
    if (plan === undefined || !isWithin(text.path, scope) || !plan.policy.triggersShrink || text.text.fontMissing) return [];
    return isWordTrigger(text, plan) ? [[text, plan] as const] : [];
  });

const wordFloorOf = (pass: Pass, plans: Plans, scope: string): number =>
  Math.max(0, ...wordTriggersIn(pass, plans, scope).map(([text, plan]) => wordDeltaOf(text, plan)));

/**
 * Cada Text com palavra partida vai sozinho ao size em que ela cabe (ou ao seu mínimo).
 * Só ele: os vizinhos não alargam a linha dele, e um delta comum arrastaria rótulos
 * pequenos ao mínimo por causa de um valor grande que não cabe.
 */
const wordPatchesOf = (pass: Pass, plans: Plans, scope: string): ReadonlyMap<string, TextPatch> =>
  new Map(
    wordTriggersIn(pass, plans, scope).flatMap(([text, plan]) => {
      const current = text.text.fontSize;
      const size = Math.min(current, plan.policy.resize(plan.from, plan.min, wordDeltaOf(text, plan)) ?? current);
      return size < current ? [[text.path, { size }] as const] : [];
    }),
  );

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
