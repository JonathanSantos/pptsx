import type { Breakpoint, DeckContext, Responsive, ResponsiveValue } from './types.ts';
/**
 * Regra única de resolução de valores responsivos (M9): usada pelo resolve (props das
 * primitivas) e por ctx.pick (código do autor). Fica em core para a precedência existir
 * num lugar só.
 */
/** O que a regra precisa de ctx (sem o próprio pick, para createContext poder montá-lo). */
export type ResponsiveContext = Pick<DeckContext, 'name' | 'aspect' | 'scale'>;
/** Chave que a engine reconhece como breakpoint (nome fixo, preset ou 'custom-<w>x<h>'). */
export declare const isBreakpointName: (key: string) => key is Breakpoint;
/** Responsivo se e só se é um objeto com a chave `base` (padding/background não têm). */
export declare const isResponsive: <T>(value: Responsive<T>) => value is ResponsiveValue<T>;
/**
 * Objeto que parece responsivo mas está malformado (JS sem tipos): só chaves de breakpoint e
 * sem `base`, ou com `base` e alguma chave que não é breakpoint. O resolve transforma em ResolveError.
 */
export declare const responsiveProblemOf: (value: unknown) => string | undefined;
/** Breakpoints ativos para um contexto, em ordem de precedência (o primeiro presente no objeto vence). */
export declare const activeBreakpointsOf: (ctx: ResponsiveContext) => readonly Breakpoint[];
/** Resolve um Responsive<T> para o contexto: nome exato do tamanho > wide > tall > base. */
export declare const pickResponsive: <T>(value: Responsive<T>, ctx: ResponsiveContext) => T;
/**
 * M17: aplica `fn` ao valor e, se ele for responsivo, a cada breakpoint (`{ base, tall }` → `{ base: fn(base),
 * tall: fn(tall) }`). Para um DS montar props responsivas (variantes) sem conhecer os breakpoints.
 */
export declare const mapResponsive: <T, U>(value: Responsive<T>, fn: (item: T) => U) => Responsive<U>;
