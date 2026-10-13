import type { Diagnostic } from '../core/types.ts';
import { segmentsOf } from './scope.ts';

// Agrupamento: N cartões iguais com o mesmo problema viram um diagnóstico só, para o
// leitor (LLM) corrigir o componente uma vez em vez de ler N mensagens idênticas.

const SEPARATOR = ' > ';
const INDEXED = /^(.*)\[(\d+)\]$/;

/** Um diagnóstico visto por um segmento indexado do path: o resto do path é a chave. */
interface Member {
  readonly position: number;
  readonly index: number;
}

interface Candidate {
  readonly key: string;
  /** Profundidade do segmento que varia; mais fundo = irmãos de um mesmo pai. */
  readonly depth: number;
  readonly base: string;
  readonly members: readonly Member[];
}

// Tamanhos entram na identidade: um 44→41 agrupado com 44→28 esconderia que um irmão coube melhor.
const identityOf = (diagnostic: Diagnostic): string =>
  [
    diagnostic.size,
    diagnostic.slide,
    diagnostic.code,
    diagnostic.severity,
    diagnostic.data?.causedBy ?? '',
    diagnostic.data?.fromSize ?? '',
    diagnostic.data?.toSize ?? '',
  ].join('\u0000');

interface Variation {
  readonly key: string;
  readonly depth: number;
  readonly base: string;
  readonly index: number;
}

/** Uma variação por segmento com [i]: o path com esse segmento curinga. */
const variationsOf = (diagnostic: Diagnostic): readonly Variation[] => {
  const segments = segmentsOf(diagnostic.path);
  return segments.flatMap((segment, depth) => {
    const match = INDEXED.exec(segment);
    if (match === null) return [];
    const base = match[1] ?? '';
    const wildcard = segments.map((other, at) => (at === depth ? `${base}[*]` : other)).join(SEPARATOR);
    return [{ key: `${identityOf(diagnostic)}\u0000${wildcard}`, depth, base, index: Number(match[2]) }];
  });
};

/** Mesmo índice duas vezes não é irmão: fica só a primeira ocorrência. */
const addMember = (members: readonly Member[], member: Member): readonly Member[] =>
  members.some((other) => other.index === member.index) ? members : [...members, member];

const candidatesOf = (diagnostics: readonly Diagnostic[]): readonly Candidate[] => {
  const byKey = diagnostics.reduce((candidates, diagnostic, position) => {
    variationsOf(diagnostic).forEach(({ key, depth, base, index }) => {
      const existing = candidates.get(key);
      const members = addMember(existing?.members ?? [], { position, index });
      candidates.set(key, { key, depth, base, members });
    });
    return candidates;
  }, new Map<string, Candidate>());
  return [...byKey.values()];
};

const firstPosition = (candidate: Candidate): number => Math.min(...candidate.members.map((member) => member.position));

/** Maior grupo primeiro (cartões iguais vencem pares dentro de um cartão); empate: mais fundo, depois o que vem antes. */
const isBetter = (a: Candidate, b: Candidate): boolean => {
  if (a.members.length !== b.members.length) return a.members.length > b.members.length;
  if (a.depth !== b.depth) return a.depth > b.depth;
  return firstPosition(a) < firstPosition(b);
};

const withoutTaken = (candidate: Candidate, taken: ReadonlySet<number>): Candidate => ({
  ...candidate,
  members: candidate.members.filter((member) => !taken.has(member.position)),
});

/** Escolha gulosa: cada diagnóstico entra em no máximo um grupo. */
const chooseGroups = (candidates: readonly Candidate[], taken: ReadonlySet<number> = new Set()): readonly Candidate[] => {
  const available = candidates.map((candidate) => withoutTaken(candidate, taken)).filter((candidate) => candidate.members.length >= 2);
  const best = available.reduce<Candidate | undefined>((chosen, candidate) => (chosen === undefined || isBetter(candidate, chosen) ? candidate : chosen), undefined);
  if (best === undefined) return [];
  const nextTaken = new Set([...taken, ...best.members.map((member) => member.position)]);
  return [best, ...chooseGroups(available, nextTaken)];
};

const isContiguous = (indices: readonly number[]): boolean => indices.every((value, at) => at === 0 || value === (indices[at - 1] ?? value) + 1);

const indexLabel = (indices: readonly number[]): string =>
  isContiguous(indices) ? `[${indices[0]}..${indices.at(-1)}]` : `[${indices.join(',')}]`;

/** Pior membro: maior overflowPt; sem ele, menor toSize; empate fica com o menor índice. */
const isWorse = (a: Diagnostic, b: Diagnostic): boolean => {
  const overflowA = a.data?.overflowPt;
  const overflowB = b.data?.overflowPt;
  if (overflowA !== undefined || overflowB !== undefined) return (overflowA ?? -Infinity) > (overflowB ?? -Infinity);
  return (a.data?.toSize ?? Infinity) < (b.data?.toSize ?? Infinity);
};

const replaceSegment = (path: string, depth: number, segment: string): string =>
  segmentsOf(path)
    .map((other, at) => (at === depth ? segment : other))
    .join(SEPARATOR);

const mergedOf = (candidate: Candidate, diagnostics: readonly Diagnostic[]): Diagnostic => {
  const members = [...candidate.members].sort((a, b) => a.index - b.index);
  const items = members.flatMap((member) => {
    const diagnostic = diagnostics[member.position];
    return diagnostic === undefined ? [] : [diagnostic];
  });
  const worst = items.reduce((chosen, item) => (isWorse(item, chosen) ? item : chosen));
  const label = `${candidate.base}${indexLabel(members.map((member) => member.index))}`;
  return {
    ...worst,
    path: replaceSegment(worst.path, candidate.depth, label),
    message: `${worst.message} (×${items.length}: mesmo problema em ${label})`,
    data: { ...worst.data, count: items.length, paths: items.map((item) => item.path) },
  };
};

/**
 * Pura: agrupa diagnósticos iguais de irmãos homônimos (mesmo size, slide, code,
 * severity e causedBy; paths iguais a menos do [i] de um único segmento). O grupo
 * fica na posição do primeiro membro; diagnósticos únicos saem como entraram.
 */
export const groupDiagnostics = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] => {
  const groups = chooseGroups(candidatesOf(diagnostics));
  if (groups.length === 0) return diagnostics;
  const groupAt = new Map(groups.map((group) => [firstPosition(group), group]));
  const grouped = new Set(groups.flatMap((group) => group.members.map((member) => member.position)));
  return diagnostics.flatMap((diagnostic, position) => {
    const group = groupAt.get(position);
    if (group !== undefined) return [mergedOf(group, diagnostics)];
    return grouped.has(position) ? [] : [diagnostic];
  });
};
