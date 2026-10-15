import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// No monorepo, pptsx e o próprio kit resolvem para o fonte (sem build), como os paths do tsconfig.
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^pptsx\/jsx-runtime$/, replacement: at('../pptsx/src/jsx/jsx-runtime.ts') },
      { find: /^pptsx\/jsx-dev-runtime$/, replacement: at('../pptsx/src/jsx/jsx-dev-runtime.ts') },
      { find: /^pptsx$/, replacement: at('../pptsx/src/index.ts') },
      { find: /^@pptsx\/ds-kit$/, replacement: at('../ds-kit/src/index.ts') },
      { find: /^@pptsx\/ds-base$/, replacement: at('./src/index.ts') },
    ],
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'pptsx' } },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
