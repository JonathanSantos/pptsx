import type { ResolvedConnector, ResolvedNode } from '../core/types.ts';
import type { InheritedText } from './draft.ts';
/** `author` = props do autor (só para validar as chaves); `raw` = as mesmas já normalizadas (cores em hex). */
export declare const resolveConnector: (author: Readonly<Record<string, unknown>>, raw: Readonly<Record<string, unknown>>, path: string, parentText: InheritedText) => ResolvedConnector;
/**
 * Ids com escopo de componente: o mesmo id pode se repetir em instâncias diferentes de componente (um Flow
 * repetido numa grade), nunca dentro do mesmo escopo. Cada repetição ganha um id interno único (`id#2`, …) e
 * cada conector se liga à ocorrência do seu escopo, subindo para os componentes de fora; empate → ResolveError.
 * Ids únicos no slide saem exatamente como o autor escreveu (nada muda para quem não repete).
 */
export interface ScopedIds {
    readonly nodes: readonly ResolvedNode[];
    readonly connectors: readonly ResolvedConnector[];
    readonly ids: ReadonlySet<string>;
}
export declare const scopeIds: (nodes: readonly ResolvedNode[], connectors: readonly ResolvedConnector[]) => ScopedIds;
/** Pontas cujo id não existe no slide: o fit emite connector-target-missing. */
export declare const withMissing: (connector: ResolvedConnector, ids: ReadonlySet<string>) => ResolvedConnector;
