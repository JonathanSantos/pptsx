import type { Child } from 'pptsx';
/**
 * Slots: áreas nomeadas de um componente (`header`, `body`, `aside`), cada uma um `Child`. Convenção
 * tipada: `Slots<'header' | 'body'>` nas props e `slot(props.header, fallback)` no corpo do componente.
 */
export type Slots<K extends string> = {
    readonly [P in K]?: Child;
};
/** O conteúdo do slot, ou o padrão quando ele não veio (null, undefined ou false). */
export declare const slot: (value: Child | undefined, fallback?: Child) => Child;
/** Os slots que vieram preenchidos (para o componente decidir o layout: com ou sem aside). */
export declare const filledSlots: <K extends string>(props: Slots<K>, names: readonly K[]) => readonly K[];
