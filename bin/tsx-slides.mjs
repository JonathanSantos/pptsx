#!/usr/bin/env node
// Registra o loader do tsx para carregar o deck .tsx, a config e o próprio código-fonte em TS.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

// O tsx lê o tsconfig do cwd para saber o jsxImportSource; fora de um projeto com tsconfig
// (ex.: rodando de outra pasta), usa o do pacote para o JSX do deck apontar para tsx-slides.
const packageTsconfig = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const tsconfig = existsSync(join(process.cwd(), 'tsconfig.json')) ? undefined : packageTsconfig;

register(tsconfig ? { tsconfig } : undefined);
const { runCli } = await import('../src/cli.ts');
process.exitCode = await runCli(process.argv.slice(2));
