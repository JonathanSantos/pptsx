#!/usr/bin/env node
// pptsx-ds: comandos do @pptsx/ds-kit. Hoje: `catalog <módulo-do-ds> [--out dir] [--size 16x9,4x3] [--check] [--fixtures dir]`.
// O módulo do DS é .ts/.tsx (export default createDs(...)): o tsx transpila com o tsconfig mais próximo dele.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

const USAGE = 'uso: pptsx-ds catalog <ds.ts> [--out dist/catalog] [--size 16x9,4x3] [--check] [--fixtures dir] [--pptx]';

const nearestTsconfig = (dir) => {
  const file = join(dir, 'tsconfig.json');
  if (existsSync(file)) return file;
  const parent = dirname(dir);
  return parent === dir ? undefined : nearestTsconfig(parent);
};

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: { out: { type: 'string' }, size: { type: 'string' }, check: { type: 'boolean', default: false }, fixtures: { type: 'string' }, pptx: { type: 'boolean', default: false } },
});
const [command, target] = positionals;
if (command !== 'catalog' || target === undefined) {
  console.error(USAGE);
  process.exit(2);
}
const file = resolve(target);
const tsconfig = nearestTsconfig(dirname(file));
const api = register({ namespace: 'pptsx-ds', ...(tsconfig ? { tsconfig } : {}) });
const inRepo = existsSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)));
const kit = await api.import(new URL(inRepo ? '../src/index.ts' : '../dist/index.js', import.meta.url).href, import.meta.url);
const module = await api.import(pathToFileURL(file).href, import.meta.url);
const ds = module.default ?? module.ds;
if (!ds || !Array.isArray(ds.implementations)) {
  console.error(`${target}: exporte default createDs({ ... }) do @pptsx/ds-kit`);
  process.exit(2);
}
const out = values.out === undefined ? undefined : resolve(values.out);
const result = await kit.catalog({
  ds,
  ...(values.size === undefined ? {} : { sizes: values.size.split(',') }),
  ...(out === undefined ? {} : { out }),
  ...(values.fixtures === undefined ? {} : { fixtures: resolve(values.fixtures) }),
  check: values.check,
  pptx: values.pptx,
  baseDir: dirname(file),
});
if (values.check) {
  if (result.diffs.length === 0) console.log(`catálogo de ${ds.name}: ${result.cases} renderizações batem com as fixtures.`);
  else result.diffs.forEach((diff) => console.log(`✖ ${diff.component} · ${diff.case} · ${diff.size}: ${diff.message}`));
  process.exitCode = result.diffs.length === 0 ? 0 : 1;
} else {
  result.files.forEach((item) => console.log(item));
  console.log(`\ncatálogo de ${ds.name}: ${result.components.length} componentes, ${result.cases} renderizações.`);
}
