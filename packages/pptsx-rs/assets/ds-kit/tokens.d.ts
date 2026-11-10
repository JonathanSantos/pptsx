/**
 * Tokens de design: um objeto aninhado e congelado. Os grupos `color`/`colors` são validados e
 * normalizados para '#RRGGBB'; números têm que ser finitos. `tokenAt('font.body')` lê por caminho.
 */
type Leaf = string | number;
export interface TokenTree {
    readonly [key: string]: Leaf | TokenTree;
}
export type Tokens<T extends TokenTree> = T & {
    /** Valor por caminho ('color.accent', 'font.body'); lança se não existir. */
    readonly tokenAt: (path: string) => Leaf;
    /** Token numérico × fator, arredondado a 0,5 pt ('font.body', 1.2). */
    readonly scale: (path: string, factor: number) => number;
};
export declare const defineTokens: <const T extends TokenTree>(tokens: T) => Tokens<T>;
/** O que as funções do kit aceitam como tokens: a árvore crua ou o resultado de `defineTokens`. */
export type TokenSource = TokenTree | Readonly<Record<string, unknown>>;
/** Todas as cores dos tokens (já '#RRGGBB'): a paleta permitida das regras de cor. */
export declare const colorsOf: (tokens: TokenSource) => readonly string[];
export {};
