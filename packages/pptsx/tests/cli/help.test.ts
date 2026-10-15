import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runCli } from '../../src/cli.ts';
import { captureConsole, type CapturedConsole } from '../helpers/console.ts';

/** `--help`/`-h`/`build --help` imprimem o uso; `--version` a versão do package.json (M7, CONTRACTS §cli). */

const VERSION = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

let output: CapturedConsole;
beforeEach(() => {
  output = captureConsole();
});
afterEach(() => output.restore());

const stdout = (): string => output.logs.join('\n');

describe('cli --help / --version', () => {
  it.each([[['--help']], [['-h']], [['build', '--help']], [['build', '-h']]])('%j → exit 0 and usage on stdout', async (argv) => {
    expect(await runCli(argv, tmpdir())).toBe(0);
    expect(stdout()).toMatch(/uso:/);
    expect(stdout()).toMatch(/pptsx build/);
    expect(stdout()).toMatch(/pptsx init/);
    expect(output.errors).toEqual([]);
  });

  it('build --help does not need a deck (nothing is built)', async () => {
    expect(await runCli(['build', 'nao-existe.tsx', '--help'], tmpdir())).toBe(0);
    expect(stdout()).toMatch(/uso:/);
  });

  it('--version → exit 0 and exactly the package.json version', async () => {
    expect(await runCli(['--version'], tmpdir())).toBe(0);
    expect(stdout().trim()).toBe(VERSION);
  });

  it('no arguments is still a usage error (exit 1)', async () => {
    expect(await runCli([], tmpdir())).toBe(1);
  });
});
