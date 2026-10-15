/**
 * Utilitários para ler diagnósticos agrupados (M6): um grupo carrega os paths
 * individuais em `data.paths`; um único, só `path`.
 */
import type { Diagnostic } from '../../src/core/types.ts';

/** Paths individuais que o diagnóstico representa. */
export const memberPaths = (d: Diagnostic): readonly string[] => d.data?.paths ?? [d.path];

/** Todos os paths individuais de uma lista (grupos expandidos), na ordem. */
export const allMemberPaths = (diagnostics: readonly Diagnostic[]): string[] => diagnostics.flatMap((d) => [...memberPaths(d)]);

/** O diagnóstico (agrupado ou não) que cobre `path` com o `code` dado. */
export const coveringDiagnostic = (
  diagnostics: readonly Diagnostic[],
  path: string,
  code?: Diagnostic['code'],
): Diagnostic | undefined =>
  diagnostics.find((d) => (code === undefined || d.code === code) && memberPaths(d).includes(path));
