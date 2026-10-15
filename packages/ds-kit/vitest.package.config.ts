import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';

// `npm run test:package`: liga os testes de pacote (lentos, fora do `npm test`) sem `VAR=1 cmd`, que o Windows não tem.
export default mergeConfig(base, defineConfig({ test: { env: { PPTSX_PACKAGE_TEST: '1' } } }));
