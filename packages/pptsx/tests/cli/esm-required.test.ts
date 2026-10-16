import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ESM_REQUIRED_MESSAGE, importUserModule, isRequireAsyncError } from '../../src/config.ts';
import type { ImportModule } from '../../src/cli/loader.ts';

/**
 * M7 "erro de CJS": deck num projeto `"type": "commonjs"` é transpilado para CJS pelo tsx e
 * faz require() de um grafo ESM com top-level await (yoga-layout) → ERR_REQUIRE_ASYNC_MODULE.
 * A CLI troca a mensagem do Node por uma que cita `"type": "module"`.
 *
 * Precisa de processo real (bin → tsx): dentro do vitest todo módulo vira ESM e o erro não acontece.
 * O deck importa a engine por caminho absoluto e sem JSX para não depender de node_modules no temporário.
 * Em ESM o caminho vai como file:// (no Windows o loader recusa "D:\\…"); em CJS, como caminho, que é o que o require() aceita.
 */

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const BIN = join(ROOT, 'bin', 'pptsx.mjs');
const TIMEOUT = 120_000;

const tmpDirs: string[] = [];
afterAll(() => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const specifier = (type: 'commonjs' | 'module', path: string): string => JSON.stringify(type === 'module' ? pathToFileURL(path).href : path);

const deckOf = (type: 'commonjs' | 'module'): string => `import { Deck, Slide, Text, defineDeck } from ${specifier(type, join(ROOT, 'src', 'index.ts'))};
import { jsx } from ${specifier(type, join(ROOT, 'src', 'jsx', 'jsx-runtime.ts'))};
export default defineDeck(() => jsx(Deck, { children: jsx(Slide, { children: jsx(Text, { children: 'oi' }) }) }));
`;

const TSCONFIG = { compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, jsx: 'react-jsx', jsxImportSource: 'pptsx' } };

const projectWith = (type: 'commonjs' | 'module'): string => {
  const dir = mkdtempSync(join(tmpdir(), `pptsx-${type}-`));
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `deck-${type}`, private: true, type }));
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(TSCONFIG));
  writeFileSync(join(dir, 'deck.tsx'), deckOf(type));
  return dir;
};

const build = (cwd: string) =>
  spawnSync(process.execPath, [BIN, 'build', 'deck.tsx', '--preview', 'none', '--out', 'dist', '--json'], {
    cwd,
    encoding: 'utf8',
    timeout: TIMEOUT,
  });

describe('cli — deck loaded as CommonJS', () => {
  it(
    '"type": "commonjs" → exit 1 and the error says to add "type": "module"',
    () => {
      const proc = build(projectWith('commonjs'));
      expect(proc.status, proc.stderr).toBe(1);
      const json = JSON.parse(proc.stdout) as { error?: unknown };
      expect(Object.keys(json)).toEqual(['error']);
      expect(json.error).toMatch(/"type": "module"/);
    },
    TIMEOUT,
  );

  it(
    'control: the same deck with "type": "module" builds (exit 0)',
    () => {
      const dir = projectWith('module');
      const proc = build(dir);
      expect(proc.status, `${proc.stdout}\n${proc.stderr}`).toBe(0);
      expect(existsSync(join(dir, 'dist', 'deck.16x9.pptx'))).toBe(true);
    },
    TIMEOUT,
  );
});

// ───────────── tradução do erro (unitário) ─────────────

const nodeError = (code: string, message: string): Error => Object.assign(new Error(message), { code });

const PPTSX_NOT_EXPORTED = nodeError(
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'No "exports" main defined in /home/u/deck/node_modules/pptsx/package.json',
);

describe('isRequireAsyncError', () => {
  it.each([
    ['ERR_REQUIRE_ASYNC_MODULE', nodeError('ERR_REQUIRE_ASYNC_MODULE', 'require() cannot be used on an ESM graph with top-level await')],
    ['the Node message without code', new Error('require() cannot be used on an ESM graph with top-level await. Use import() instead.')],
    ['ERR_PACKAGE_PATH_NOT_EXPORTED from node_modules/pptsx', PPTSX_NOT_EXPORTED],
    [
      'ERR_PACKAGE_PATH_NOT_EXPORTED from node_modules\\pptsx (Windows)',
      nodeError('ERR_PACKAGE_PATH_NOT_EXPORTED', 'No "exports" main defined in C:\\deck\\node_modules\\pptsx\\package.json'),
    ],
    ['ERR_REQUIRE_CYCLE_MODULE (Node 20.19+)', nodeError('ERR_REQUIRE_CYCLE_MODULE', 'Cannot require() ES Module /tmp/deck.tsx in a cycle.')],
    ['the Node 22 message without code', new Error("request for './primitives/index.ts' is from a module not been linked")],
  ])('true for %s', (_case, error) => {
    expect(isRequireAsyncError(error)).toBe(true);
  });

  it.each([
    ['ERR_PACKAGE_PATH_NOT_EXPORTED from another package', nodeError('ERR_PACKAGE_PATH_NOT_EXPORTED', 'No "exports" main defined in /x/node_modules/outro/package.json')],
    ['a syntax error', new SyntaxError('Unexpected token')],
    ['module not found', nodeError('ERR_MODULE_NOT_FOUND', "Cannot find package 'pptsx'")],
    ['a non-Error value', 'ERR_REQUIRE_ASYNC_MODULE'],
  ])('false for %s', (_case, error) => {
    expect(isRequireAsyncError(error)).toBe(false);
  });
});

describe('importUserModule — error translation', () => {
  const failingWith =
    (error: unknown): ImportModule =>
    () =>
      Promise.reject(error);

  it('pptsx not exported (deck as CJS) → message citing "type": "module", original as cause', async () => {
    const promise = importUserModule('/p/deck.tsx', { fresh: false, cwd: '/p' }, failingWith(PPTSX_NOT_EXPORTED));
    await expect(promise).rejects.toThrow(/"type": "module"/);
    await expect(promise).rejects.toThrow('/p/deck.tsx');
    await expect(promise).rejects.toMatchObject({ cause: PPTSX_NOT_EXPORTED });
    expect(ESM_REQUIRED_MESSAGE).toMatch(/"type": "module"/);
  });

  it('other errors pass through unchanged', async () => {
    const original = new SyntaxError('Unexpected token');
    await expect(importUserModule('/p/deck.tsx', { fresh: false, cwd: '/p' }, failingWith(original))).rejects.toBe(original);
  });

  it('success returns the module', async () => {
    const module = { default: () => null };
    const ok: ImportModule = () => Promise.resolve(module);
    await expect(importUserModule('/p/deck.tsx', { fresh: true, cwd: '/p' }, ok)).resolves.toBe(module);
  });
});
