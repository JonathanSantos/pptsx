import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { defaultImportModule } from '../cli/loader.ts';
import { loadConfig } from '../config.ts';
import type { DsManifest } from '../ds.ts';
import { createPptsxMcpServer } from './server.ts';

/** M16-3: `pptsx-mcp` por stdio. O stdout é do protocolo: nada aqui (nem nas ferramentas) imprime nele. */
const packageVersion = (): string => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { readonly version?: string };
  return pkg.version ?? '0.0.0';
};

/** `--ds <pacote>` (repetível) na linha de comando do servidor. */
export const dsArgsOf = (argv: readonly string[]): readonly string[] =>
  argv.flatMap((arg, index) => (arg === '--ds' && argv[index + 1] !== undefined ? [argv[index + 1]!] : arg.startsWith('--ds=') ? [arg.slice('--ds='.length)] : []));

const isManifest = (value: unknown): value is DsManifest =>
  typeof value === 'object' && value !== null && typeof (value as DsManifest).name === 'string' && Array.isArray((value as DsManifest).rules);

/** M17: o pacote é resolvido a partir do cwd (onde o DS está instalado), não do pptsx. */
export const importDs = async (specifier: string, cwd: string): Promise<DsManifest> => {
  const require = createRequire(join(cwd, 'noop.js'));
  // Um DS em .ts (no repo, ou ainda não compilado) é transpilado com o tsconfig da pasta dele (paths, jsx).
  const module = (await defaultImportModule(require.resolve(specifier), { fresh: false, cwd })) as { readonly default?: unknown; readonly ds?: unknown };
  const manifest = module.default ?? module.ds;
  if (!isManifest(manifest)) throw new Error(`--ds ${specifier}: o pacote precisa exportar default (ou "ds") um defineDs({ ... })`);
  return manifest;
};

/** DS do pptsx.config.ts do cwd e dos `--ds`; o mesmo nome duas vezes vale uma. */
export const dsOfServer = async (cwd: string, argv: readonly string[]): Promise<readonly DsManifest[]> => {
  const config = await loadConfig(cwd, { fresh: false, cwd }, defaultImportModule);
  const fromArgs = await Promise.all(dsArgsOf(argv).map((specifier) => importDs(specifier, cwd)));
  const all = [...(config.ds ?? []), ...fromArgs];
  return all.filter((ds, index) => all.findIndex((other) => other.name === ds.name) === index);
};

export const runMcpServer = async (cwd: string = process.cwd(), argv: readonly string[] = process.argv.slice(2)): Promise<void> => {
  const server = createPptsxMcpServer({ cwd, ds: await dsOfServer(cwd, argv) }, packageVersion());
  await server.connect(new StdioServerTransport());
};
