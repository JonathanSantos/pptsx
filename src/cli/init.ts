import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  DECK_FILE,
  GITIGNORE_FILE,
  NEXT_COMMAND,
  PACKAGE_FILE,
  TSCONFIG_FILE,
  gitignoreContent,
  mergePackageJson,
  scaffoldFiles,
  type ScaffoldFile,
} from './scaffold.ts';
import { mergeTsconfig } from './tsconfig.ts';

export const INIT_USAGE = 'uso: pptsx init [dir] [--force] [--json]';

export interface InitArgs {
  readonly dir: string;
  readonly force: boolean;
  readonly json: boolean;
}

/** O que o init vai gravar e o que preserva do usuário. */
export interface InitPlan {
  readonly writes: readonly ScaffoldFile[];
  readonly kept: readonly string[];
  readonly warnings: readonly string[];
  /** Subconjunto de `writes` que já existia (sobrescrito com --force ou mesclado). */
  readonly updated: readonly string[];
}

export interface InitReport {
  readonly files: readonly string[];
}

export const parseInitCli = (argv: readonly string[], cwd: string = process.cwd()): InitArgs => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      force: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  });
  const [command, dir, ...extra] = positionals;
  if (command !== 'init' || extra.length > 0) throw new Error(INIT_USAGE);
  return { dir: resolve(cwd, dir ?? '.'), force: values.force, json: values.json };
};

export const deckExistsMessage = (deckPath: string): string =>
  `${deckPath} já existe; use --force para sobrescrever (pptsx init <dir> --force)`;

interface FilePlan {
  readonly write?: ScaffoldFile;
  readonly warning?: string;
}

// .gitignore e package.json são sempre mesclados: --force não deve apagar o que o usuário já tinha.
// tsconfig.json existente só ganha as chaves de JSX que faltam (--force o substitui).
const planFile = (
  file: ScaffoldFile,
  existing: ReadonlyMap<string, string>,
  force: boolean,
  dirName: string,
): FilePlan => {
  const current = existing.get(file.path);
  if (file.path === GITIGNORE_FILE) {
    const merged = gitignoreContent(current);
    return merged === current && !force ? {} : { write: { ...file, content: merged } };
  }
  if (file.path === PACKAGE_FILE) {
    const merged = mergePackageJson(current, dirName);
    if (merged.kind === 'write') return { write: { ...file, content: merged.content }, warning: merged.warning };
    return merged.kind === 'warn' ? { warning: merged.warning } : {};
  }
  if (current === undefined || force) return { write: file };
  if (file.path === TSCONFIG_FILE) {
    const merged = mergeTsconfig(current);
    if (merged.kind === 'write') return { write: { ...file, content: merged.content }, warning: merged.warning };
    return merged.kind === 'warn' ? { warning: merged.warning } : {};
  }
  return {};
};

/**
 * `existing` mapeia caminho relativo → conteúdo atual dos arquivos que já existem.
 * Sem --force, um deck.tsx existente aborta; os demais arquivos existentes são mantidos.
 */
export const planInit = (
  files: readonly ScaffoldFile[],
  existing: ReadonlyMap<string, string>,
  force: boolean,
  deckPath: string = DECK_FILE,
  dirName: string = 'pptsx-deck',
): InitPlan => {
  if (existing.has(DECK_FILE) && !force) throw new Error(deckExistsMessage(deckPath));
  const planned = files.map((file) => ({ file, plan: planFile(file, existing, force, dirName) }));
  return {
    writes: planned.flatMap(({ plan }) => (plan.write ? [plan.write] : [])),
    kept: planned.flatMap(({ file, plan }) => (plan.write ? [] : [file.path])),
    warnings: planned.flatMap(({ plan }) => (plan.warning ? [plan.warning] : [])),
    updated: planned.flatMap(({ file, plan }) => (plan.write && existing.has(file.path) ? [file.path] : [])),
  };
};

export const nextStepsOf = (dir: string, cwd: string): readonly string[] => {
  const relativeDir = relative(cwd, dir);
  // Fora do cwd (muitos `../`) o caminho absoluto é mais legível.
  const target = relativeDir.startsWith('..') ? dir : relativeDir;
  const cd = relativeDir === '' ? [] : [`cd ${target}`];
  return [...cd, NEXT_COMMAND, `${NEXT_COMMAND} --watch`];
};

export const initSummaryOf = (dir: string, plan: InitPlan, cwd: string): string =>
  [
    `Projeto pptsx em ${dir}:`,
    ...plan.writes.map((file) => `  ${plan.updated.includes(file.path) ? 'atualizado' : 'criado    '} ${file.path}`),
    ...plan.kept.map((path) => `  mantido    ${path}`),
    ...plan.warnings.map((warning) => `\n▲ ${warning}`),
    '',
    'Próximos passos:',
    ...nextStepsOf(dir, cwd).map((step) => `  ${step}`),
  ].join('\n');

export const initJsonOf = (dir: string, plan: InitPlan): string =>
  JSON.stringify({ files: plan.writes.map((file) => join(dir, file.path)) } satisfies InitReport, null, 2);

// ---------- IO ----------

const readExisting = (dir: string, files: readonly ScaffoldFile[]): ReadonlyMap<string, string> =>
  new Map(
    files.flatMap((file) => {
      const path = join(dir, file.path);
      return existsSync(path) ? [[file.path, readFileSync(path, 'utf8')] as const] : [];
    }),
  );

const writeFile = (dir: string, file: ScaffoldFile): void => {
  const path = join(dir, file.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, file.content);
};

export const runInit = (args: InitArgs, cwd: string): number => {
  const dirName = basename(args.dir);
  const files = scaffoldFiles(dirName);
  const plan = planInit(files, readExisting(args.dir, files), args.force, join(args.dir, DECK_FILE), dirName);
  mkdirSync(args.dir, { recursive: true });
  plan.writes.forEach((file) => writeFile(args.dir, file));
  // No --json o stdout é só o JSON; o aviso vai para stderr para não se perder.
  if (args.json) plan.warnings.forEach((warning) => console.error(`▲ ${warning}`));
  console.log(args.json ? initJsonOf(args.dir, plan) : initSummaryOf(args.dir, plan, cwd));
  return 0;
};
