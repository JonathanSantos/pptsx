import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';

// `npm run test:standalone`: liga a paridade do bundle de arquivo único (lenta, fora do `npm test`).
export default mergeConfig(base, defineConfig({ test: { env: { PPTSX_STANDALONE_TEST: '1' } } }));
