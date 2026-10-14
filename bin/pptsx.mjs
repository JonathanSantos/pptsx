#!/usr/bin/env node
// Registra o loader do tsx: o deck e a config do usuário são .tsx/.ts e precisam ser transpilados.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

const fromPackage = (path) => new URL(`../${path}`, import.meta.url);

// No repo existe o fonte e ele vence: um dist/ velho de um build anterior nunca mascara o código atual.
// O pacote publicado não leva src/ (ver `files`), então instalado roda sempre o JS compilado.
const inRepo = existsSync(fileURLToPath(fromPackage('src/cli.ts')));

// O tsx lê o tsconfig do cwd para saber o jsxImportSource; sem um no cwd, usa o do pacote.
// Instalado é o mínimo sem `paths` (pptsx resolve por node_modules); no repo, o tsconfig de
// desenvolvimento, cujo `paths` aponta pptsx para src/ sem exigir build.
const packageTsconfig = fileURLToPath(fromPackage(inRepo ? 'tsconfig.json' : 'tsconfig.deck.json'));
const tsconfig = existsSync(join(process.cwd(), 'tsconfig.json')) ? undefined : packageTsconfig;

register(tsconfig ? { tsconfig } : undefined);

const { runCli } = await import(fromPackage(inRepo ? 'src/cli.ts' : 'dist/cli.js').href);
process.exitCode = await runCli(process.argv.slice(2));
