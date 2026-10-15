import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PROPS_SCHEMA } from '../mcp/schema.generated.ts';
import { standaloneRuntime } from '../standalone.ts';
import { skillFiles, type SkillDs, type SkillFile } from './skill.ts';

/**
 * M18-8: a borda da skill — lê do pacote o guia, a versão, o repositório (para a URL da release) e o
 * SHA256 do bundle, se ele foi gerado (`dist/standalone/SHA256SUMS`). O `pptsx-ds skill` do kit usa isto.
 */

export interface CreateSkillOptions {
  readonly ds?: SkillDs;
  readonly name?: string;
  /** Base das releases (`…/releases/download/v<versão>`); padrão: a do `repository` do package.json. */
  readonly releaseBase?: string;
}

interface PackageInfo {
  readonly version: string;
  readonly repository?: string | { readonly url?: string };
}

const packageFile = (path: string): URL => new URL(`../../${path}`, import.meta.url);

const packageInfo = (): PackageInfo => JSON.parse(readFileSync(packageFile('package.json'), 'utf8')) as PackageInfo;

/** `github:dono/repo`, `https://github.com/dono/repo(.git)` ou `git+https://…` → `dono/repo`. */
export const githubRepoOf = (repository: PackageInfo['repository']): string | undefined => {
  const raw = typeof repository === 'string' ? repository : repository?.url;
  if (raw === undefined) return undefined;
  const match = /^(?:github:|(?:git\+)?https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/.]+)(?:\.git)?\/?$/.exec(raw.trim());
  return match?.[1];
};

const bundleShaOf = (): string | undefined => {
  const sums = packageFile('dist/standalone/SHA256SUMS');
  if (!existsSync(sums)) return undefined;
  return readFileSync(sums, 'utf8').split('\n').find((line) => line.trim().endsWith('pptsx.mjs'))?.trim().split(/\s+/)[0];
};

export const createSkillFiles = (options: CreateSkillOptions = {}): readonly SkillFile[] => {
  const runtime = standaloneRuntime();
  const pkg = runtime === undefined ? packageInfo() : { version: runtime.version };
  const repo = runtime === undefined ? githubRepoOf(pkg.repository) : undefined;
  const releaseBase = options.releaseBase ?? (repo === undefined ? undefined : `https://github.com/${repo}/releases/download/v${pkg.version}`);
  const sha = runtime === undefined ? bundleShaOf() : undefined;
  return skillFiles({
    version: pkg.version,
    guide: runtime?.guide ?? readFileSync(packageFile('docs/AGENT_GUIDE.md'), 'utf8'),
    schema: PROPS_SCHEMA,
    ...(releaseBase === undefined ? {} : { releaseBase }),
    ...(sha === undefined ? {} : { bundleSha256: sha }),
    ...(options.ds === undefined ? {} : { ds: options.ds }),
    ...(options.name === undefined ? {} : { name: options.name }),
  });
};

/** Grava os arquivos na pasta (o script com permissão de execução). Devolve os caminhos. */
export const writeSkill = (out: string, files: readonly SkillFile[]): readonly string[] =>
  files.map((file) => {
    const path = join(out, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content, file.path.endsWith('scripts/pptsx.mjs') ? { mode: 0o755 } : {});
    return path;
  });
