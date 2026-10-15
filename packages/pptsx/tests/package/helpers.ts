import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Peças dos testes de pacote (M7-E; M18-5 nos três pacotes): `npm pack` → projeto vazio fora do repo →
 * `npm install <tarballs>`. Só rodam com PPTSX_PACKAGE_TEST (o `vitest.package.config.ts` de cada pacote
 * define a variável, sem a sintaxe `VAR=1 cmd` que o Windows não tem). Precisam de rede ou do cache do npm.
 */

export const PACKAGE_TEST_ENABLED = Boolean(process.env.PPTSX_PACKAGE_TEST);
export const PACKAGE_TIMEOUT = 240_000;

export interface PackedTarball {
  readonly tarball: string;
  readonly files: readonly string[];
  /** Tamanho do .tgz em bytes. */
  readonly size: number;
}

interface PackResult {
  readonly filename: string;
  readonly size: number;
  readonly files: readonly { readonly path: string }[];
}

const tmpDirs: string[] = [];

export const freshDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
};

export const removeFreshDirs = (): void => tmpDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));

// No Windows npm/npx são .cmd: sem shell o spawn não os acha.
export const run = (command: string, args: readonly string[], cwd: string): SpawnSyncReturns<string> =>
  spawnSync(command, [...args], {
    cwd,
    encoding: 'utf8',
    timeout: PACKAGE_TIMEOUT,
    shell: process.platform === 'win32',
    env: { ...process.env, npm_config_yes: 'true' },
  });

export const describeRun = (proc: SpawnSyncReturns<string>): string => `status ${proc.status}\n--- stdout\n${proc.stdout}\n--- stderr\n${proc.stderr}`;

// O stdout do `npm pack --json` pode trazer a saída do prepack antes do JSON.
const packJsonOf = (stdout: string): readonly PackResult[] => {
  const start = stdout.search(/^\[/m);
  if (start === -1) throw new Error(`npm pack --json sem JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start)) as PackResult[];
};

export const pack = (packageDir: string, destination: string): PackedTarball => {
  const proc = run('npm', ['pack', '--json', '--pack-destination', destination], packageDir);
  if (proc.status !== 0) throw new Error(`npm pack falhou em ${packageDir}\n${describeRun(proc)}`);
  const [result] = packJsonOf(proc.stdout);
  if (!result) throw new Error('npm pack --json vazio');
  return { tarball: join(destination, result.filename), files: result.files.map((file) => file.path), size: result.size };
};

export const npmInstall = (packages: readonly string[], cwd: string): SpawnSyncReturns<string> =>
  run('npm', ['install', ...packages, '--no-audit', '--no-fund', '--prefer-offline', '--loglevel=error'], cwd);

/** Um bin instalado no projeto (`npx --no` nunca baixa do registro; o `--` impede o npx de ler `-p` etc. do bin). */
export const npxBin = (bin: string, args: readonly string[], cwd: string): SpawnSyncReturns<string> => run('npx', ['--no', '--', bin, ...args], cwd);
