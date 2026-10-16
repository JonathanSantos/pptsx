import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runCli } from '../../src/cli.ts';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { TYPES_DIR, TYPE_ROOTS, declarationFilesOf, jsxShimOf, typesSourceDir, writeTypes } from '../../src/cli/types.ts';
import { mergeTsconfig } from '../../src/cli/tsconfig.ts';
import { captureConsole, type CapturedConsole } from '../helpers/console.ts';

/** 1.0.5 (CONTRACTS §cli "tipos"): `init`/`types` gravam os .d.ts em .pptsx/types (um typeRoots do tsconfig). */

const dirs: string[] = [];
const freshDir = (prefix = 'pptsx-types-'): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

let output: CapturedConsole;
beforeEach(() => {
  output = captureConsole();
});
afterEach(() => output.restore());

/** Um dist/ de brinquedo: dois .d.ts em pastas e um .js que não conta. */
const fakeSource = (): string => {
  const source = freshDir('pptsx-dist-');
  mkdirSync(join(source, 'jsx'), { recursive: true });
  writeFileSync(join(source, 'index.d.ts'), 'export declare const x: 1;\n');
  writeFileSync(join(source, 'jsx', 'jsx-runtime.d.ts'), "import type { X } from '../core/types.ts';\nexport declare const jsx: X;\nexport {};\n");
  writeFileSync(join(source, 'jsx', 'jsx-dev-runtime.d.ts'), "export { jsx } from './jsx-runtime.ts';\n");
  writeFileSync(join(source, 'index.js'), 'export const x = 1;\n');
  return source;
};

describe('writeTypes', () => {
  it('copia só os .d.ts, preservando as pastas, e grava o pacote de tipos (package.json, entry, shim do JSX, README)', () => {
    const source = fakeSource();
    const project = freshDir();
    const written = writeTypes(project, source)!;
    expect(written.count).toBe(3);
    expect(written.dir).toBe(TYPES_DIR);
    expect(declarationFilesOf(source)).toEqual(['index.d.ts', 'jsx/jsx-dev-runtime.d.ts', 'jsx/jsx-runtime.d.ts']);
    expect(existsSync(join(project, TYPES_DIR, 'jsx', 'jsx-runtime.d.ts'))).toBe(true);
    expect(existsSync(join(project, TYPES_DIR, 'index.js'))).toBe(false);
    expect(JSON.parse(readFileSync(join(project, TYPES_DIR, 'package.json'), 'utf8'))).toEqual({ name: 'pptsx', types: './entry.d.ts' });
    expect(readFileSync(join(project, TYPES_DIR, 'entry.d.ts'), 'utf8')).toContain('/// <reference path="./jsx-shim.d.ts" />');
    const shim = readFileSync(join(project, TYPES_DIR, 'jsx-shim.d.ts'), 'utf8');
    expect(shim).toContain("declare module 'pptsx/jsx-runtime' {");
    expect(shim).toContain("import type { X } from 'pptsx';");
    expect(shim).toContain("export { jsx } from 'pptsx/jsx-runtime';");
    expect(shim).not.toContain('export {};');
    expect(readFileSync(join(project, TYPES_DIR, 'README.md'), 'utf8')).toMatch(/Tipos do pptsx \d+\.\d+\.\d+ .*pptsx types/);
  });

  it('jsxShimOf: troca os imports relativos pelos do pacote e indenta dentro do declare module', () => {
    const shim = jsxShimOf("import { A } from '../core/types.ts';\nexport declare const jsx: A;\nexport {};\n", "export { jsx } from './jsx-runtime.ts';\n");
    expect(shim.split('\n')).toEqual(expect.arrayContaining(["  import { A } from 'pptsx';", '  export declare const jsx: A;', "  export { jsx } from 'pptsx/jsx-runtime';"]));
  });

  it('sem fonte (bundle sem dist/), devolve undefined e não grava nada', () => {
    const project = freshDir();
    expect(writeTypes(project, undefined)).toBeUndefined();
    expect(existsSync(join(project, '.pptsx'))).toBe(false);
  });
});

describe('mergeTsconfig — typeRoots dos tipos', () => {
  it('tsconfig pronto sem typeRoots ganha o do scaffold e avisa', () => {
    const merged = mergeTsconfig(JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx' } }));
    expect(merged.kind).toBe('write');
    if (merged.kind !== 'write') return;
    const parsed = JSON.parse(merged.content) as { compilerOptions: { typeRoots: unknown } };
    expect(parsed.compilerOptions.typeRoots).toEqual(TYPE_ROOTS);
    expect(merged.warning).toContain('typeRoots com os tipos do pptsx em .pptsx/types');
  });

  it('typeRoots do usuário ficam, a cópia local entra na frente; com ela presente, mantém', () => {
    const merged = mergeTsconfig(JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx', typeRoots: ['./typings'] } }));
    expect(merged.kind).toBe('write');
    if (merged.kind !== 'write') return;
    expect((JSON.parse(merged.content) as { compilerOptions: { typeRoots: unknown } }).compilerOptions.typeRoots).toEqual(['./.pptsx/types', './typings']);
    expect(mergeTsconfig(merged.content).kind).toBe('keep');
  });
});

// Só com o dist/ do pacote construído (no repo, `npm run build`); o CI constrói antes dos testes.
const hasDist = typesSourceDir() !== undefined;

describe.skipIf(!hasDist)('pptsx types / init — com o dist/ do pacote', () => {
  it('types numa pasta vazia: grava os tipos, cria o tsconfig e imprime uma linha', async () => {
    const dir = freshDir();
    expect(await runCli(['types', dir], tmpdir())).toBe(0);
    expect(existsSync(join(dir, TYPES_DIR, 'index.d.ts'))).toBe(true);
    expect(existsSync(join(dir, TYPES_DIR, 'jsx', 'jsx-runtime.d.ts'))).toBe(true);
    const tsconfig = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8')) as { compilerOptions: { typeRoots: unknown } };
    expect(tsconfig.compilerOptions.typeRoots).toEqual(TYPE_ROOTS);
    expect(output.logs.join('\n')).toMatch(/Tipos do pptsx .* arquivos\); tsconfig\.json criado\.$/);
  });

  it('types num projeto com tsconfig sem typeRoots: mescla e avisa; rodando de novo, "já aponta"', async () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx' } }));
    expect(await runCli(['types', dir], tmpdir())).toBe(0);
    expect(output.logs.at(-1)).toContain('typeRoots com os tipos do pptsx');
    expect(await runCli(['types', dir], tmpdir())).toBe(0);
    expect(output.logs.at(-1)).toContain('já aponta para os tipos');
  });

  // O que o editor vê: o tsc do repo, no projeto do init, sem node_modules nenhum. Um deck errado tem que falhar
  // (prova que os tipos valem, não que o módulo caiu em `any`).
  const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript')), 'tsc.js');
  const typecheck = (dir: string): { readonly code: number; readonly out: string } => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) };
    } catch (error) {
      const failed = error as { readonly status?: number; readonly stdout?: string; readonly stderr?: string };
      return { code: failed.status ?? 1, out: `${failed.stdout ?? ''}${failed.stderr ?? ''}` };
    }
  };

  it('o deck do init compila com o tsc sem node_modules (pptsx e o JSX vêm de .pptsx/types); um erro de prop é apontado', { timeout: 120_000 }, async () => {
    const dir = freshDir();
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(existsSync(join(dir, 'node_modules'))).toBe(false);
    const ok = typecheck(dir);
    expect(ok.out).toBe('');
    expect(ok.code).toBe(0);
    writeFileSync(join(dir, 'deck.tsx'), "import { Deck, Slide, Text, defineDeck } from 'pptsx';\nexport default defineDeck(() => (<Deck><Slide><Text fontSize=\"grande\">x</Text></Slide></Deck>));\n");
    const bad = typecheck(dir);
    expect(bad.code).not.toBe(0);
    expect(bad.out).toMatch(/TS2322.*"grande"/);
  });

  it('init grava os tipos, lista a linha "tipos" e o --json traz "types"', async () => {
    const dir = freshDir();
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(existsSync(join(dir, TYPES_DIR, 'index.d.ts'))).toBe(true);
    expect(output.logs.join('\n')).toMatch(/ {2}tipos {6}\.pptsx\/types\/pptsx\/ \(\d+ \.d\.ts do pptsx /);
    const other = freshDir();
    expect(await runCli(['init', other, '--json'], tmpdir())).toBe(0);
    const json = JSON.parse(output.logs.at(-1)!) as { files: string[]; types?: string };
    expect(json.types).toBe(join(other, TYPES_DIR));
  });
});
