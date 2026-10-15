import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { importDs } from '../mcp/ds.ts';
import { createSkillFiles, writeSkill } from '../skill/create.ts';
import { SKILL_DESTINATIONS, skillNameOf, type SkillDs } from '../skill/skill.ts';

/** M18-8: `pptsx skill --out <pasta> [--ds <pacote|caminho>] [--name nome] [--release-url base]`. */

export const SKILL_USAGE = 'uso: pptsx skill --out <pasta> [--ds <pacote|caminho>] [--name nome] [--release-url base]';

export interface SkillArgs {
  readonly out: string;
  readonly ds?: string;
  readonly name?: string;
  readonly releaseUrl?: string;
}

export const parseSkillCli = (argv: readonly string[], cwd: string = process.cwd()): SkillArgs => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { out: { type: 'string' }, ds: { type: 'string' }, name: { type: 'string' }, 'release-url': { type: 'string' } },
  });
  if (positionals[0] !== 'skill' || positionals.length > 1 || values.out === undefined) throw new Error(SKILL_USAGE);
  return {
    out: resolve(cwd, values.out),
    ...(values.ds === undefined ? {} : { ds: values.ds }),
    ...(values.name === undefined ? {} : { name: values.name }),
    ...(values['release-url'] === undefined ? {} : { releaseUrl: values['release-url'] }),
  };
};

const isPathSpec = (spec: string): boolean => spec.startsWith('.') || isAbsolute(spec);

// O deck importa o DS pelo nome do pacote: num caminho, vale o package.json mais próximo do módulo.
const packageNameNear = (file: string): string | undefined => {
  const search = (dir: string): string | undefined => {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) return (JSON.parse(readFileSync(pkg, 'utf8')) as { readonly name?: string }).name;
    const parent = dirname(dir);
    return parent === dir ? undefined : search(parent);
  };
  return search(dirname(file));
};

export const loadSkillDs = async (spec: string, cwd: string): Promise<SkillDs> => {
  const manifest = await importDs(spec, cwd);
  if (!isPathSpec(spec)) return { manifest, importFrom: spec };
  const file = createRequire(join(cwd, 'noop.js')).resolve(spec);
  return { manifest, importFrom: packageNameNear(file) ?? manifest.name };
};

export const runSkill = async (args: SkillArgs, cwd: string): Promise<number> => {
  const ds = args.ds === undefined ? undefined : await loadSkillDs(args.ds, cwd);
  const name = args.name ?? (ds === undefined ? 'pptsx' : skillNameOf(ds.importFrom));
  const files = createSkillFiles({ name, ...(ds === undefined ? {} : { ds }), ...(args.releaseUrl === undefined ? {} : { releaseBase: args.releaseUrl }) });
  writeSkill(args.out, files);
  const rel = relative(cwd, args.out);
  // Fora do cwd (muitos `../`) o caminho absoluto é mais legível.
  const where = rel === '' ? '.' : rel.startsWith('..') ? args.out : rel;
  console.log(
    [
      `Skill ${name} em ${where}:`,
      ...SKILL_DESTINATIONS.map((destination) => `  ${destination}/${name}/  (SKILL.md, references/, scripts/pptsx.mjs)`),
      '  .vscode/mcp.json  (Copilot no VS Code)',
      '  .mcp.json  (Claude Code)',
      '',
      'Copie para a raiz do repositório do agente; o README.md da pasta explica cada destino.',
    ].join('\n'),
  );
  return 0;
};
