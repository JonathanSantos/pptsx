/**
 * Tabela de despacho por `kind` sem cast espalhado pelos módulos: o tipo da tabela
 * garante que cada entrada recebe o nó certo; o único cast fica aqui.
 */
export type DispatchTable<N extends { readonly kind: string }, R, Extra extends readonly unknown[] = []> = {
  readonly [K in N['kind']]: (node: Extract<N, { readonly kind: K }>, ...extra: Extra) => R;
};

export const dispatch = <N extends { readonly kind: string }, R, Extra extends readonly unknown[] = []>(
  table: DispatchTable<N, R, Extra>,
  node: N,
  ...extra: Extra
): R => (table[node.kind as N['kind']] as (node: N, ...extra: Extra) => R)(node, ...extra);
