import { toHexColor } from 'pptsx';

/**
 * Tokens de design: um objeto aninhado e congelado. Os grupos `color`/`colors` são validados e
 * normalizados para '#RRGGBB'; números têm que ser finitos. `tokenAt('font.body')` lê por caminho.
 */

type Leaf = string | number;
export interface TokenTree {
  readonly [key: string]: Leaf | TokenTree;
}

const COLOR_GROUPS = new Set(['color', 'colors']);

const isTree = (value: unknown): value is TokenTree => typeof value === 'object' && value !== null && !Array.isArray(value);

const normalize = (tree: TokenTree, path: readonly string[], inColor: boolean): TokenTree =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => {
      const here = [...path, key];
      if (isTree(value)) return [key, normalize(value, here, inColor || COLOR_GROUPS.has(key))];
      if (inColor) {
        try {
          return [key, toHexColor(value)];
        } catch (error) {
          throw new Error(`defineTokens: ${here.join('.')} não é uma cor (${(error as Error).message})`);
        }
      }
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`defineTokens: ${here.join('.')} não é um número finito`);
      return [key, value];
    }),
  );

const deepFreeze = <T>(value: T): T => {
  if (isTree(value)) Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export type Tokens<T extends TokenTree> = T & {
  /** Valor por caminho ('color.accent', 'font.body'); lança se não existir. */
  readonly tokenAt: (path: string) => Leaf;
  /** Token numérico × fator, arredondado a 0,5 pt ('font.body', 1.2). */
  readonly scale: (path: string, factor: number) => number;
};

const at = (tree: TokenTree, path: string): Leaf => {
  const value = path.split('.').reduce<Leaf | TokenTree | undefined>((node, key) => (isTree(node) ? node[key] : undefined), tree);
  if (value === undefined || isTree(value)) throw new Error(`token "${path}" não existe (ou é um grupo)`);
  return value;
};

const HALF_POINT = 2;

export const defineTokens = <const T extends TokenTree>(tokens: T): Tokens<T> => {
  const tree = normalize(tokens, [], false) as T;
  const tokenAt = (path: string): Leaf => at(tree, path);
  const scale = (path: string, factor: number): number => {
    const value = tokenAt(path);
    if (typeof value !== 'number') throw new Error(`token "${path}" não é numérico`);
    return Math.round(value * factor * HALF_POINT) / HALF_POINT;
  };
  return deepFreeze({ ...tree, tokenAt, scale });
};

/** O que as funções do kit aceitam como tokens: a árvore crua ou o resultado de `defineTokens`. */
export type TokenSource = TokenTree | Readonly<Record<string, unknown>>;

/** Todas as cores dos tokens (já '#RRGGBB'): a paleta permitida das regras de cor. */
export const colorsOf = (tokens: TokenSource): readonly string[] => {
  const walk = (tree: TokenSource, inColor: boolean): readonly string[] =>
    Object.entries(tree).flatMap(([key, value]) => {
      if (isTree(value)) return walk(value, inColor || COLOR_GROUPS.has(key));
      // As funções de defineTokens (tokenAt, scale) não são tokens.
      return inColor && typeof value === 'string' ? [value] : [];
    });
  return [...new Set(walk(tokens, false))];
};
