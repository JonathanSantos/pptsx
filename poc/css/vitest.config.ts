import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (path: string) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url));

// Mesmos aliases do vitest da raiz: os decks de examples/ importam 'pptsx'.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [
      { find: /^pptsx\/jsx-runtime$/, replacement: src('jsx/jsx-runtime.ts') },
      { find: /^pptsx\/jsx-dev-runtime$/, replacement: src('jsx/jsx-dev-runtime.ts') },
      { find: /^pptsx$/, replacement: src('index.ts') },
    ],
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'pptsx' } },
  test: { include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 120_000 },
});
