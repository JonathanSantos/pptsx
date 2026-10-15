import type { Responsive, ResponsiveValue } from 'pptsx';

/**
 * Deriva um valor responsivo de outro, chave a chave: `{ base: 20, wide: 24 }` com
 * `s => s * 0.7` vira `{ base: 14, wide: 16.8 }`. Mantém as mesmas chaves (e as mesmas
 * chaves ausentes), então a precedência da engine escolhe o mesmo breakpoint nos dois:
 * o resultado é f(valor resolvido) em qualquer tamanho, sem o componente conhecer ctx.
 */
export const mapResponsive = <T, U>(value: Responsive<T>, f: (v: T) => U): Responsive<U> => {
  if (!isResponsiveValue(value)) return f(value);
  const entries = Object.entries(value as Readonly<Record<string, T | undefined>>)
    .map(([key, v]) => [key, v === undefined ? undefined : f(v)] as const);
  return Object.fromEntries(entries) as ResponsiveValue<U>;
};

// A engine não exporta o teste de forma; a regra é a mesma: objeto com a chave própria `base`.
const isResponsiveValue = <T>(value: Responsive<T>): value is ResponsiveValue<T> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.hasOwn(value, 'base');
