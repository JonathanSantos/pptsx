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
  esbuild: { jsx: 'automatic', jsxImportSource: 'pptsx' },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
