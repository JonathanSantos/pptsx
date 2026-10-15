#!/usr/bin/env node
// M18-5: confere os três pacotes antes de publicar — `npm publish --dry-run` sem nenhum aviso (o npm 11
// "corrige" e REMOVE um `bin` com "./" só na publicação; o `npm pack` não mostra isso) e os campos do manifest.
// `--strict` (workflow de publicação): campos do dono (`repository`, sem `private`) também viram erro.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const strict = process.argv.includes('--strict');
const workspaces = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces;

// Avisos que o dry-run sempre dá fora da CI de publicação e não dizem nada do pacote.
const BENIGN = [/requires you to be logged in/i, /Unknown (cli|env) config/i];
// O pacote ainda `private`: a decisão de tirar é do dono (com --strict, `ownerProblems` acusa).
const PRIVATE = /marked as private/i;

const fieldProblems = (pkg) => [
  ...['license', 'description', 'exports', 'files', 'engines'].filter((key) => pkg[key] === undefined).map((key) => `sem "${key}"`),
  ...(pkg.sideEffects === false ? [] : ['"sideEffects" deveria ser false']),
  ...(pkg.publishConfig?.provenance === true ? [] : ['"publishConfig.provenance" deveria ser true']),
  ...['LICENSE', 'README.md', 'THIRD_PARTY.md'].filter((file) => !pkg.files?.includes(file)).map((file) => `"files" sem ${file}`),
  ...Object.entries(pkg.bin ?? {}).filter(([, path]) => path.startsWith('./')).map(([name]) => `bin "${name}" começa com "./" (o npm 11 o remove ao publicar)`),
];

const ownerProblems = (pkg) => [
  ...(pkg.repository === undefined ? ['sem "repository" (a provenance exige a URL do repositório no GitHub)'] : []),
  ...(pkg.private === true ? ['"private": true (o npm recusa publicar)'] : []),
];

const check = (workspace) => {
  const dir = join(root, workspace);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const proc = spawnSync('npm', ['publish', '--dry-run', '--ignore-scripts'], { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
  const warnings = proc.stderr
    .split(/\r?\n/)
    .filter((line) => /^npm (warn|error)/i.test(line) && !BENIGN.some((pattern) => pattern.test(line)) && !PRIVATE.test(line));
  const errors = [...fieldProblems(pkg), ...warnings, ...(strict ? ownerProblems(pkg) : []), ...(proc.status === 0 ? [] : [`npm publish --dry-run saiu com ${proc.status}`])];
  const pending = strict ? [] : ownerProblems(pkg);
  return { name: pkg.name, version: pkg.version, errors, pending };
};

const results = workspaces.map(check);
results.forEach(({ name, version, errors, pending }) => {
  console.log(`${errors.length === 0 ? '✓' : '✖'} ${name}@${version}`);
  errors.forEach((error) => console.log(`    ✖ ${error}`));
  pending.forEach((item) => console.log(`    ▲ pendente do dono: ${item}`));
});
process.exitCode = results.some((result) => result.errors.length > 0) ? 1 : 0;
