/**
 * M18-7: no bundle, `tsx/esm/api` vira isto. A compilação do .tsx fica com os hooks globais (hooks.ts);
 * cada "namespace" só importa a URL (o `?pptsx-fresh` do --watch passa pelos hooks).
 */
export const register = (_options?: unknown) => ({
  import: (specifier: string, _parent?: string): Promise<unknown> => import(specifier),
  unregister: (): void => undefined,
});
