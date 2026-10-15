import type { Child } from 'pptsx';

/**
 * Slots: áreas nomeadas de um componente (`header`, `body`, `aside`), cada uma um `Child`. Convenção
 * tipada: `Slots<'header' | 'body'>` nas props e `slot(props.header, fallback)` no corpo do componente.
 */
export type Slots<K extends string> = { readonly [P in K]?: Child };

/** O conteúdo do slot, ou o padrão quando ele não veio (null, undefined ou false). */
export const slot = (value: Child | undefined, fallback: Child = null): Child =>
  value === undefined || value === null || value === false ? fallback : value;

/** Os slots que vieram preenchidos (para o componente decidir o layout: com ou sem aside). */
export const filledSlots = <K extends string>(props: Slots<K>, names: readonly K[]): readonly K[] =>
  names.filter((name) => props[name] !== undefined && props[name] !== null && props[name] !== false);
