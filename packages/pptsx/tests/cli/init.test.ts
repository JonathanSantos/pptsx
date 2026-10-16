import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
import { runCli } from '../../src/cli.ts';
import { TYPE_ROOTS, typesSourceDir } from '../../src/cli/types.ts';
import { captureConsole, type CapturedConsole } from '../helpers/console.ts';

/** `pptsx init [dir] [--force] [--json]` (M7-B), em processo. */

const TIMEOUT = 60_000;
const SCAFFOLD = ['deck.tsx', 'tsconfig.json', 'pptsx.config.ts', 'assets/.gitkeep', '.gitignore', 'package.json'] as const;
// 1.0.5: com o dist/ do pacote (CI constrói antes), o init também grava .pptsx/types e o --json ganha "types".
const JSON_KEYS = typesSourceDir() === undefined ? ['files'] : ['files', 'types'];

const tmpDirs: string[] = [];
const freshDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'pptsx-init-'));
  tmpDirs.push(dir);
  return dir;
};
afterAll(() => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

let output: CapturedConsole;
beforeEach(() => {
  output = captureConsole();
});
afterEach(() => output.restore());

const read = (dir: string, file: string): string => readFileSync(join(dir, file), 'utf8');
const readJson = (dir: string, file: string): Record<string, unknown> =>
  JSON.parse(read(dir, file)) as Record<string, unknown>;
const snapshotOf = (dir: string): Record<string, string> =>
  Object.fromEntries(SCAFFOLD.map((file) => [file, read(dir, file)]));
const allOutput = (): string => [...output.logs, ...output.errors].join('\n');

describe('init — files', () => {
  it('creates deck.tsx, tsconfig.json, pptsx.config.ts, assets/.gitkeep, .gitignore and package.json', async () => {
    const dir = freshDir();
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    for (const file of SCAFFOLD) expect(existsSync(join(dir, file)), file).toBe(true);
  });

  it('tsconfig.json: react-jsx, jsxImportSource pptsx, NodeNext, strict, skipLibCheck', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    const options = readJson(dir, 'tsconfig.json').compilerOptions as Record<string, unknown>;
    expect(options).toMatchObject({
      jsx: 'react-jsx',
      jsxImportSource: 'pptsx',
      module: 'NodeNext',
      strict: true,
      skipLibCheck: true,
    });
  });

  it('.gitignore lists dist/', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    expect(read(dir, '.gitignore').split(/\r?\n/)).toContain('dist/');
  });

  it('deck.tsx only depends on pptsx (no examples/) and pptsx.config.ts uses defineConfig', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    const deck = read(dir, 'deck.tsx');
    expect(deck).toMatch(/from ['"]pptsx['"]/);
    expect(deck).toMatch(/export default defineDeck\(/);
    expect(deck).not.toMatch(/examples\//);
    expect([...deck.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])).toEqual(['pptsx']);
    expect(read(dir, 'pptsx.config.ts')).toMatch(/defineConfig\(/);
  });

  it('without dir: initializes the cwd', async () => {
    const dir = freshDir();
    expect(await runCli(['init'], dir)).toBe(0);
    expect(existsSync(join(dir, 'deck.tsx'))).toBe(true);
  });

  it('prints the next commands', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    expect(output.logs.join('\n')).toMatch(/pptsx build deck\.tsx/);
  });
});

describe('init — package.json', () => {
  it('no package.json → created with "type": "module"', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    expect(readJson(dir, 'package.json').type).toBe('module');
  });

  it('package.json without type → gains "type": "module" and keeps the other keys', async () => {
    const dir = freshDir();
    const original = { name: 'meu-deck', version: '1.2.3', scripts: { slides: 'pptsx build deck.tsx' }, dependencies: { pptsx: '^0.1.0' } };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(original, null, 2));
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(readJson(dir, 'package.json')).toEqual({ ...original, type: 'module' });
  });

  it('"type": "commonjs" → switched to "module" (other keys kept), with a warning', async () => {
    const dir = freshDir();
    const original = { name: 'legado', version: '1.0.0', main: 'index.js', type: 'commonjs', license: 'ISC' };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(original, null, 2));
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(readJson(dir, 'package.json')).toEqual({ ...original, type: 'module' });
    // Aviso da troca: cita o tipo antigo e o novo (texto exato a critério do coder).
    expect(allOutput()).toMatch(/"commonjs"[\s\S]*"module"/);
  });

  it('"type": "commonjs" with --json: stdout stays pure JSON, the warning goes to stderr', async () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'legado', type: 'commonjs' }));
    expect(await runCli(['init', dir, '--json'], tmpdir())).toBe(0);
    const json = JSON.parse(output.logs.join('\n')) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(JSON_KEYS);
    expect(output.errors.join('\n')).toMatch(/"commonjs"[\s\S]*"module"/);
    expect(readJson(dir, 'package.json').type).toBe('module');
  });

  it('"type": "module" already → package.json untouched', async () => {
    const dir = freshDir();
    const raw = `${JSON.stringify({ name: 'pronto', type: 'module', scripts: { x: 'y' } }, null, 4)}\n`;
    writeFileSync(join(dir, 'package.json'), raw);
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(read(dir, 'package.json')).toBe(raw);
  });
});

describe('init — existing tsconfig.json', () => {
  it('without jsx/jsxImportSource → gains both and the types typeRoots, keeps the other keys (2-space JSON), warns', async () => {
    const dir = freshDir();
    const original = {
      compilerOptions: { target: 'ES2020', strict: true, outDir: 'out', paths: { '@/*': ['./src/*'] } },
      include: ['src', 'deck.tsx'],
    };
    writeFileSync(join(dir, 'tsconfig.json'), `${JSON.stringify(original, null, 2)}\n`);
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    const merged = readJson(dir, 'tsconfig.json');
    expect(merged).toEqual({
      ...original,
      compilerOptions: { ...original.compilerOptions, jsx: 'react-jsx', jsxImportSource: 'pptsx', typeRoots: TYPE_ROOTS },
    });
    expect(read(dir, 'tsconfig.json')).toMatch(/^ {2}"compilerOptions"/m);
    expect(read(dir, 'tsconfig.json')).not.toMatch(/^ {4}"compilerOptions"/m);
    expect(allOutput()).toMatch(/tsconfig/);
  });

  it('only jsxImportSource missing → it and the types typeRoots are added, nothing else', async () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx', strict: true } }, null, 2));
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(readJson(dir, 'tsconfig.json').compilerOptions).toEqual({ jsx: 'react-jsx', strict: true, jsxImportSource: 'pptsx', typeRoots: TYPE_ROOTS });
  });

  it('jsxImportSource "react" → untouched, with a warning', async () => {
    const dir = freshDir();
    const raw = `${JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react', strict: true } }, null, 2)}\n`;
    writeFileSync(join(dir, 'tsconfig.json'), raw);
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(read(dir, 'tsconfig.json')).toBe(raw);
    expect(allOutput()).toMatch(/jsxImportSource/);
    expect(allOutput()).toMatch(/pptsx/);
  });

  it('already pptsx-ready with the types typeRoots → untouched, no tsconfig warning', async () => {
    const dir = freshDir();
    const raw = `${JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx', strict: false, typeRoots: TYPE_ROOTS } }, null, 2)}\n`;
    writeFileSync(join(dir, 'tsconfig.json'), raw);
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(read(dir, 'tsconfig.json')).toBe(raw);
    expect(output.errors.join('\n')).not.toMatch(/tsconfig/);
    expect(output.logs.join('\n')).not.toMatch(/▲[^\n]*tsconfig/);
  });

  it('pptsx-ready without typeRoots (1.0.5) → gains only the types typeRoots, with a warning naming them', async () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx', strict: false } }, null, 2)}\n`);
    expect(await runCli(['init', dir], tmpdir())).toBe(0);
    expect(readJson(dir, 'tsconfig.json').compilerOptions).toEqual({ jsx: 'react-jsx', jsxImportSource: 'pptsx', strict: false, typeRoots: TYPE_ROOTS });
    expect(allOutput()).toMatch(/typeRoots com os tipos do pptsx/);
  });
});

describe('init — existing deck', () => {
  it('second init without --force → exit 1 and nothing is overwritten', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    writeFileSync(join(dir, 'deck.tsx'), '// meu deck editado\n');
    writeFileSync(join(dir, 'pptsx.config.ts'), '// minha config\n');
    const before = snapshotOf(dir);
    expect(await runCli(['init', dir], tmpdir())).toBe(1);
    expect(snapshotOf(dir)).toEqual(before);
    expect(output.errors.join('\n')).toMatch(/--force/);
  });

  it('deck.tsx alone (no other scaffold file) also blocks init without --force', async () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'deck.tsx'), '// meu deck\n');
    expect(await runCli(['init', dir], tmpdir())).toBe(1);
    expect(read(dir, 'deck.tsx')).toBe('// meu deck\n');
    expect(existsSync(join(dir, 'tsconfig.json'))).toBe(false);
  });

  it('--json with an existing deck → exit 1 and stdout {error}', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    output.logs.length = 0;
    expect(await runCli(['init', dir, '--json'], tmpdir())).toBe(1);
    const json = JSON.parse(output.logs.join('\n')) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(['error']);
  });

  it('--force overwrites deck.tsx with the template', async () => {
    const dir = freshDir();
    await runCli(['init', dir], tmpdir());
    const template = read(dir, 'deck.tsx');
    writeFileSync(join(dir, 'deck.tsx'), '// meu deck editado\n');
    expect(await runCli(['init', dir, '--force'], tmpdir())).toBe(0);
    expect(read(dir, 'deck.tsx')).toBe(template);
  });
});

describe('init --json', () => {
  it('stdout is only { files } (and "types" when the package has dist/) and every listed file exists', async () => {
    const dir = freshDir();
    expect(await runCli(['init', dir, '--json'], tmpdir())).toBe(0);
    const json = JSON.parse(output.logs.join('\n')) as { files?: unknown };
    expect(Object.keys(json)).toEqual(JSON_KEYS);
    expect(Array.isArray(json.files)).toBe(true);
    const files = (json.files as string[]).map((file) => resolve(tmpdir(), file));
    for (const file of files) expect(existsSync(file), file).toBe(true);
    const expected = SCAFFOLD.map((file) => join(dir, file));
    expect([...files].sort()).toEqual([...expected].sort());
  });
});

describe('init → build', () => {
  it(
    'the generated deck compiles and renders (2 slides, exit 0)',
    async () => {
      const dir = freshDir();
      expect(await runCli(['init', dir], tmpdir())).toBe(0);
      const out = join(dir, 'dist');
      const code = await runCli(['build', join(dir, 'deck.tsx'), '--preview', 'none', '--out', out], dir);
      expect(code, output.errors.join('\n')).toBe(0);
      const pptx = join(out, 'deck.16x9.pptx');
      expect(existsSync(pptx)).toBe(true);
      const zip = await JSZip.loadAsync(readFileSync(pptx));
      expect(zip.file('ppt/slides/slide2.xml')).not.toBeNull();
      expect(zip.file('ppt/slides/slide3.xml')).toBeNull();
    },
    TIMEOUT,
  );

  it(
    'also in 4x3 (the deck adapts to ctx) without errors',
    async () => {
      const dir = freshDir();
      mkdirSync(join(dir, 'sub'));
      expect(await runCli(['init', 'sub'], dir)).toBe(0);
      const project = join(dir, 'sub');
      const code = await runCli(
        ['build', 'deck.tsx', '--preview', 'none', '--size', '16x9,4x3', '--json', '--out', 'dist'],
        project,
      );
      expect(code, output.logs.join('\n')).toBe(0);
      expect(existsSync(join(project, 'dist', 'deck.4x3.pptx'))).toBe(true);
    },
    TIMEOUT,
  );
});
