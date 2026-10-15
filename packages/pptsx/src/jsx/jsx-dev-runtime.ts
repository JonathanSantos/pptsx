import { jsx } from './jsx-runtime.ts';

export { Fragment } from './jsx-runtime.ts';
export type { JSX } from './jsx-runtime.ts';

/** Os argumentos extras de dev (source, self) são ignorados: não há DevTools aqui. */
export const jsxDEV = jsx;
