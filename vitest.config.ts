import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^tsx-slides\/jsx-runtime$/, replacement: src('jsx/jsx-runtime.ts') },
      { find: /^tsx-slides\/jsx-dev-runtime$/, replacement: src('jsx/jsx-dev-runtime.ts') },
      { find: /^tsx-slides$/, replacement: src('index.ts') },
    ],
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'tsx-slides' },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
