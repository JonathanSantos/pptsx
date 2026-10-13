import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Diagnostic } from '../../src/core/types.ts';
import { isPng } from '../helpers/png.ts';

/** Contrato M5 da CLI testado como processo real (bin → tsx → src/cli.ts). */

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const BIN = join(ROOT, 'bin', 'tsx-slides.mjs');
const TIMEOUT = 120_000;

const tmpDirs: string[] = [];
const freshDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'tsx-slides-cli-'));
  tmpDirs.push(dir);
  return dir;
};

afterAll(() => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const run = (args: readonly string[]) =>
  spawnSync(process.execPath, [BIN, ...args], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT });

interface BuildJson {
  readonly files: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

const parseStdout = (stdout: string): unknown => JSON.parse(stdout);

describe('cli process — build --json', () => {
  it(
    'hello.tsx: stdout is pure JSON {files, diagnostics}, exit 0, files follow the spec tree',
    () => {
      const out = freshDir();
      const proc = run(['build', 'examples/hello.tsx', '--out', out, '--json']);
      expect(proc.status, proc.stderr).toBe(0);

      // stdout inteiro precisa ser um único JSON (sem resumo, sem lista de arquivos).
      const json = parseStdout(proc.stdout) as BuildJson;
      expect(Object.keys(json).sort()).toEqual(['diagnostics', 'files']);
      expect(Array.isArray(json.files)).toBe(true);
      expect(Array.isArray(json.diagnostics)).toBe(true);
      expect(json.diagnostics.some((d) => d.severity === 'error')).toBe(false);

      const expected = [
        join(out, 'hello.16x9.pptx'),
        join(out, 'hello.16x9.overview.png'),
        join(out, 'hello.16x9', 'slide-01.png'),
        join(out, 'hello.diagnostics.json'),
      ];
      for (const file of expected) expect(existsSync(file), file).toBe(true);
      expect(isPng(readFileSync(join(out, 'hello.16x9.overview.png')))).toBe(true);
      expect(isPng(readFileSync(join(out, 'hello.16x9', 'slide-01.png')))).toBe(true);

      // Cada entrada de `files` aponta para um arquivo que existe.
      const listed = json.files.map((file) => resolve(ROOT, file));
      for (const file of listed) expect(existsSync(file), file).toBe(true);
      expect(listed).toEqual(expect.arrayContaining([expected[0], expected[1], expected[3]]));

      const onDisk = JSON.parse(readFileSync(join(out, 'hello.diagnostics.json'), 'utf8')) as unknown;
      expect(onDisk).toEqual(json.diagnostics);
    },
    TIMEOUT,
  );

  it(
    'multiple sizes incl. custom: one pptx per size',
    () => {
      const out = freshDir();
      const proc = run(['build', 'examples/hello.tsx', '--out', out, '--json', '--size', '16x9,10x7.5in', '--preview', 'none']);
      expect(proc.status, proc.stderr).toBe(0);
      parseStdout(proc.stdout);
      expect(existsSync(join(out, 'hello.16x9.pptx'))).toBe(true);
      expect(existsSync(join(out, 'hello.custom-10x7.5.pptx'))).toBe(true);
      // --preview none: sem PNGs.
      expect(existsSync(join(out, 'hello.16x9.overview.png'))).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'overflow.tsx: exit 1 and diagnostics with an error',
    () => {
      const out = freshDir();
      const proc = run(['build', 'examples/overflow.tsx', '--out', out, '--json', '--preview', 'none']);
      expect(proc.status).toBe(1);
      const json = parseStdout(proc.stdout) as BuildJson;
      expect(json.diagnostics.some((d) => d.severity === 'error')).toBe(true);
      expect(existsSync(join(out, 'overflow.diagnostics.json'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'missing deck with --json: stdout {error}, exit 1',
    () => {
      const out = freshDir();
      const proc = run(['build', 'examples/does-not-exist.tsx', '--out', out, '--json']);
      expect(proc.status).toBe(1);
      const json = parseStdout(proc.stdout) as { error?: unknown };
      expect(Object.keys(json)).toEqual(['error']);
      expect(typeof json.error).toBe('string');
      expect((json.error as string).length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'without --json: human summary (not JSON) and exit 0 for hello.tsx',
    () => {
      const out = freshDir();
      const proc = run(['build', 'examples/hello.tsx', '--out', out, '--preview', 'none']);
      expect(proc.status, proc.stderr).toBe(0);
      expect(() => JSON.parse(proc.stdout)).toThrow();
      expect(proc.stdout).toContain('hello.16x9.pptx');
    },
    TIMEOUT,
  );

  it(
    'invalid command: exit 1',
    () => {
      const proc = run(['bogus', 'examples/hello.tsx']);
      expect(proc.status).toBe(1);
    },
    TIMEOUT,
  );
});
