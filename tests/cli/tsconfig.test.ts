import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.ts';
import type { ImportModule, UserModule } from '../../src/cli/loader.ts';
import { nearestTsconfigOf, parseJsonc, tsconfigProblemOf } from '../../src/cli/tsconfig.ts';
import { captureConsole, type CapturedConsole } from '../helpers/console.ts';

/**
 * "M7 tsconfig do deck" (CONTRACTS §cli): antes de importar o deck, a CLI exige o tsconfig.json mais
 * próximo com compilerOptions.jsx e jsxImportSource = "pptsx" (com `extends`, confia).
 * Os decks ficam em os.tmpdir(): sob o repo o tsconfig da raiz atenderia.
 */

const READY = { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx', strict: true } } as const;

describe('tsconfigProblemOf', () => {
  it.each([
    ['undefined (no tsconfig)', undefined],
    ['not an object', 'texto'],
    ['an array', []],
    ['no compilerOptions', { include: ['src'] }],
    ['no jsx', { compilerOptions: { jsxImportSource: 'pptsx' } }],
    ['no jsxImportSource', { compilerOptions: { jsx: 'react-jsx' } }],
    ['jsxImportSource react', { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' } }],
  ])('%s → problem citing pptsx init', (_case, tsconfig) => {
    const problem = tsconfigProblemOf(tsconfig, '/p/deck.tsx');
    expect(problem).toBeTypeOf('string');
    expect(problem).toMatch(/pptsx init/);
    expect(problem).toMatch(/jsxImportSource/);
    expect(problem).toContain('/p/deck.tsx');
  });

  it.each([
    ['complete', READY],
    ['jsx react-jsxdev', { compilerOptions: { jsx: 'react-jsxdev', jsxImportSource: 'pptsx' } }],
    ['with extends (trusted, chain not resolved)', { extends: './base.json' }],
    ['with extends and no jsx', { extends: '@tsconfig/node20/tsconfig.json', compilerOptions: { strict: true } }],
  ])('%s → ok', (_case, tsconfig) => {
    expect(tsconfigProblemOf(tsconfig)).toBeUndefined();
  });
});

describe('parseJsonc / nearestTsconfigOf', () => {
  it('reads comments and trailing commas, without touching strings that look like comments', () => {
    const text = `{
      // comentário
      "compilerOptions": { "jsx": "react-jsx", /* bloco */ "jsxImportSource": "pptsx", },
      "include": ["./src/*", "http://x"],
    }`;
    expect(parseJsonc(text)).toEqual({
      compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx' },
      include: ['./src/*', 'http://x'],
    });
  });

  it('invalid JSON or non-object → undefined', () => {
    expect(parseJsonc('{ nope')).toBeUndefined();
    expect(parseJsonc('[1]')).toBeUndefined();
  });

  it('finds the nearest tsconfig.json going up', () => {
    const root = freshDir();
    writeFileSync(join(root, 'tsconfig.json'), '{}');
    const nested = join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    expect(nearestTsconfigOf(nested)).toBe(join(root, 'tsconfig.json'));
    writeFileSync(join(root, 'a', 'tsconfig.json'), '{}');
    expect(nearestTsconfigOf(nested)).toBe(join(root, 'a', 'tsconfig.json'));
  });
});

// ───────────── runCli build: validação antes do import ─────────────

const tmpDirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pptsx-tsconfig-'));
  tmpDirs.push(dir);
  return dir;
}
afterAll(() => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

let output: CapturedConsole;
beforeEach(() => {
  output = captureConsole();
});
afterEach(() => output.restore());

const DECK = `import { Deck, Slide, Text, defineDeck } from 'pptsx';
export default defineDeck(() => (<Deck><Slide><Text>oi</Text></Slide></Deck>));
`;

const projectWith = (tsconfig?: string, deckSubdir = ''): { readonly dir: string; readonly deck: string } => {
  const dir = freshDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'deck', private: true, type: 'module' }));
  if (tsconfig !== undefined) writeFileSync(join(dir, 'tsconfig.json'), tsconfig);
  const deckDir = join(dir, deckSubdir);
  mkdirSync(deckDir, { recursive: true });
  const deck = join(deckDir, 'deck.tsx');
  writeFileSync(deck, DECK);
  return { dir, deck };
};

/** Importador do vitest espionado: registra cada arquivo pedido. */
const spyImport = () => {
  const files: string[] = [];
  const importModule: ImportModule = (file) => {
    files.push(file);
    return import(/* @vite-ignore */ `${pathToFileURL(file).href}?v=${process.hrtime.bigint()}`) as Promise<UserModule>;
  };
  return { importModule, files };
};

const build = (dir: string, deck: string, importModule: ImportModule, json = false) =>
  runCli(['build', deck, '--preview', 'none', '--out', join(dir, 'dist'), ...(json ? ['--json'] : [])], dir, { importModule });

describe('runCli build — deck tsconfig check', () => {
  it('no tsconfig.json → exit 1, message cites pptsx init, deck is not imported', async () => {
    const { dir, deck } = projectWith();
    const spy = spyImport();
    expect(await build(dir, deck, spy.importModule)).toBe(1);
    expect(output.errors.join('\n')).toMatch(/pptsx init/);
    expect(spy.files).not.toContain(deck);
  });

  it('with --json → stdout {error} citing pptsx init', async () => {
    const { dir, deck } = projectWith();
    const spy = spyImport();
    expect(await build(dir, deck, spy.importModule, true)).toBe(1);
    const json = JSON.parse(output.logs.join('\n')) as { error?: unknown };
    expect(Object.keys(json)).toEqual(['error']);
    expect(json.error).toMatch(/pptsx init/);
    expect(spy.files).not.toContain(deck);
  });

  it('tsconfig without jsxImportSource → exit 1 before importing', async () => {
    const { dir, deck } = projectWith(JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } }));
    const spy = spyImport();
    expect(await build(dir, deck, spy.importModule)).toBe(1);
    expect(output.errors.join('\n')).toMatch(/jsxImportSource/);
    expect(spy.files).not.toContain(deck);
  });

  it('ready tsconfig (JSONC) → builds (exit 0)', async () => {
    const { dir, deck } = projectWith(`{\n  // gerado à mão\n  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "pptsx", },\n}\n`);
    const spy = spyImport();
    expect(await build(dir, deck, spy.importModule), output.errors.join('\n')).toBe(0);
    expect(spy.files).toContain(deck);
  });

  it('tsconfig in a parent directory counts (nearest one going up)', async () => {
    const { dir, deck } = projectWith(JSON.stringify(READY), 'slides/q3');
    const spy = spyImport();
    expect(await build(dir, deck, spy.importModule), output.errors.join('\n')).toBe(0);
  });

  it('tsconfig with extends is trusted (deck is imported)', async () => {
    const { dir, deck } = projectWith(JSON.stringify({ extends: './base.json' }));
    writeFileSync(join(dir, 'base.json'), JSON.stringify(READY));
    const spy = spyImport();
    expect(await build(dir, deck, spy.importModule), output.errors.join('\n')).toBe(0);
    expect(spy.files).toContain(deck);
  });
});
