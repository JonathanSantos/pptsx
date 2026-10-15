import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^pptsx\/jsx-runtime$/, replacement: src('jsx/jsx-runtime.ts') },
      { find: /^pptsx\/jsx-dev-runtime$/, replacement: src('jsx/jsx-dev-runtime.ts') },
      { find: /^pptsx$/, replacement: src('index.ts') },
    ],
  },
  // Vite 8 transpila com oxc; o bloco `esbuild` antigo só gerava aviso de opções duplicadas.
  oxc: { jsx: { runtime: 'automatic', importSource: 'pptsx' } },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
