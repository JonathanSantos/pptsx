import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { COMPONENT_META, type ComponentMeta } from '../core/types.ts';
import type { DsManifest } from '../ds.ts';
import { withDs, type DsDeckComponent, type DsDeckSource } from './ds-scaffold.ts';
import { defaultImportModule } from './loader.ts';
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
import { TYPES_DIR, TYPES_MISSING_WARNING, typesLineOf, typesSourceDir, writeTypes } from './types.ts';

export const INIT_USAGE = 'uso: pptsx init [dir] [--ds <pacote|caminho>] [--force] [--json]';
export const TYPES_USAGE = 'uso: pptsx types [dir]   (regrava os tipos do pptsx em .pptsx/types e o typeRoots do tsconfig)';

export interface InitArgs {
  readonly dir: string;
  readonly force: boolean;
  readonly json: boolean;
  /** M18-4: o design system que o deck inicial usa (pacote instalado ou caminho). */
  readonly ds?: string;
}

/** O que o init vai gravar e o que preserva do usuário. */
export interface InitPlan {
  readonly writes: readonly ScaffoldFile[];
  readonly kept: readonly string[];
  readonly warnings: readonly string[];
  /** Subconjunto de `writes` que já existia (sobrescrito com --force ou mesclado). */
  readonly updated: readonly string[];
  /** 1.0.5: a linha dos tipos gravados em .pptsx/types (cli/types.ts); ausente quando não havia .d.ts para copiar. */
  readonly types?: string;
}

export interface InitReport {
  readonly files: readonly string[];
  /** 1.0.5: pasta absoluta dos tipos, quando gravados. */
  readonly types?: string;
}

export const parseInitCli = (argv: readonly string[], cwd: string = process.cwd()): InitArgs => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      force: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      ds: { type: 'string' },
    },
  });
  const [command, dir, ...extra] = positionals;
  if (command !== 'init' || extra.length > 0) throw new Error(INIT_USAGE);
  return { dir: resolve(cwd, dir ?? '.'), force: values.force, json: values.json, ...(values.ds === undefined ? {} : { ds: values.ds }) };
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
    ...(plan.types === undefined ? [] : [`  tipos      ${plan.types}`]),
    ...plan.warnings.map((warning) => `\n▲ ${warning}`),
    '',
    'Próximos passos:',
    ...nextStepsOf(dir, cwd).map((step) => `  ${step}`),
  ].join('\n');

export const initJsonOf = (dir: string, plan: InitPlan): string =>
  JSON.stringify(
    { files: plan.writes.map((file) => join(dir, file.path)), ...(plan.types === undefined ? {} : { types: join(dir, TYPES_DIR) }) } satisfies InitReport,
    null,
    2,
  );

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

// ---------- --ds (M18-4) ----------

const DS_ENTRIES = ['index.ts', 'index.tsx', 'ds.ts', 'index.js'] as const;
const MONOREPO_TSCONFIG = 'tsconfig.monorepo.json';

const toImportPath = (from: string, file: string): string => {
  const rel = relative(from, file).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
};

const isPathSpec = (spec: string, cwd: string): boolean => spec.startsWith('.') || isAbsolute(spec) || existsSync(resolve(cwd, spec));

/** Caminho → o arquivo de entrada (pasta: index.ts, ds.ts…) e o import relativo ao deck; pacote → resolvido do cwd. */
const dsEntryOf = (spec: string, dir: string, cwd: string): { readonly file: string; readonly importFrom: string; readonly dsDir?: string } => {
  if (!isPathSpec(spec, cwd)) return { file: createRequire(join(cwd, 'noop.js')).resolve(spec), importFrom: spec };
  const target = resolve(cwd, spec);
  const file = statSync(target).isDirectory() ? DS_ENTRIES.map((entry) => join(target, entry)).find((path) => existsSync(path)) : target;
  if (file === undefined) throw new Error(`--ds ${spec}: a pasta não tem ${DS_ENTRIES.join(', ')}`);
  const inside = !relative(dir, file).startsWith('..');
  return { file, importFrom: toImportPath(dir, file), ...(inside || !/\.tsx?$/.test(file) ? {} : { dsDir: toImportPath(dir, dirname(file)) }) };
};

const isManifest = (value: unknown): value is DsManifest =>
  typeof value === 'object' && value !== null && typeof (value as DsManifest).name === 'string' && Array.isArray((value as DsManifest).components);

const firstCaseOf = (meta: ComponentMeta): Readonly<Record<string, unknown>> | undefined => {
  const first: unknown = Array.isArray(meta.catalog) ? meta.catalog[0] : undefined;
  return typeof first === 'object' && first !== null && 'props' in first ? (first.props as Readonly<Record<string, unknown>>) : undefined;
};

// Só entra o componente que o módulo exporta com o nome do meta (é o que o deck consegue importar).
const deckComponentsOf = (manifest: DsManifest, module: Readonly<Record<string, unknown>>): readonly DsDeckComponent[] =>
  manifest.components.flatMap((meta): readonly DsDeckComponent[] => {
    const props = firstCaseOf(meta);
    const exported = module[meta.name] as { readonly [COMPONENT_META]?: ComponentMeta } | undefined;
    return props !== undefined && typeof exported === 'function' && exported[COMPONENT_META] !== undefined ? [{ name: meta.name, props }] : [];
  });

const monorepoTsconfigFor = (dir: string): string | undefined => {
  const search = (current: string): string | undefined => {
    if (existsSync(join(current, MONOREPO_TSCONFIG))) return join(current, MONOREPO_TSCONFIG);
    const parent = dirname(current);
    return parent === current ? undefined : search(parent);
  };
  const found = search(dir);
  return found === undefined ? undefined : toImportPath(dir, found);
};

/** Carrega o módulo do DS e devolve o que o deck inicial precisa saber dele. */
export const loadDsSource = async (spec: string, dir: string, cwd: string): Promise<DsDeckSource> => {
  const entry = dsEntryOf(spec, dir, cwd);
  const module = (await defaultImportModule(entry.file, { fresh: false, cwd })) as Readonly<Record<string, unknown>>;
  const named = isManifest(module.ds);
  const manifest = named ? module.ds : module.default;
  if (!isManifest(manifest)) throw new Error(`--ds ${spec}: o módulo precisa exportar "ds" (ou default) um defineDs/createDs`);
  const tsconfigExtends = monorepoTsconfigFor(dir);
  return {
    importFrom: entry.importFrom,
    dsName: manifest.name,
    dsExport: named ? 'named' : 'default',
    ...(manifest.theme === undefined ? {} : { theme: manifest.theme }),
    components: deckComponentsOf(manifest, module),
    ...(tsconfigExtends === undefined ? {} : { tsconfigExtends }),
    ...(entry.dsDir === undefined ? {} : { dsDir: entry.dsDir }),
  };
};

/** Cria/atualiza os arquivos do projeto e devolve o plano; não imprime (o MCP usa por stdio). */
export const applyInit = (args: Pick<InitArgs, 'dir' | 'force'>, source?: DsDeckSource): InitPlan => {
  const dirName = basename(args.dir);
  const files = source === undefined ? scaffoldFiles(dirName) : withDs(scaffoldFiles(dirName), source);
  const plan = planInit(files, readExisting(args.dir, files), args.force, join(args.dir, DECK_FILE), dirName);
  mkdirSync(args.dir, { recursive: true });
  plan.writes.forEach((file) => writeFile(args.dir, file));
  return withTypes(plan, writeTypes(args.dir, typesSourceDir()));
};

const withTypes = (plan: InitPlan, written: ReturnType<typeof writeTypes>): InitPlan =>
  written === undefined ? { ...plan, warnings: [...plan.warnings, TYPES_MISSING_WARNING] } : { ...plan, types: typesLineOf(written) };

// ---------- types (1.0.5) ----------

export interface TypesArgs {
  readonly dir: string;
}

export const parseTypesCli = (argv: readonly string[], cwd: string = process.cwd()): TypesArgs => {
  const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: {} });
  const [command, dir, ...extra] = positionals;
  if (command !== 'types' || extra.length > 0) throw new Error(TYPES_USAGE);
  return { dir: resolve(cwd, dir ?? '.') };
};

const tsconfigNoteOf = (dir: string): string => {
  const path = join(dir, TSCONFIG_FILE);
  if (!existsSync(path)) {
    writeFileSync(path, scaffoldFiles().find((file) => file.path === TSCONFIG_FILE)!.content);
    return 'tsconfig.json criado';
  }
  const merged = mergeTsconfig(readFileSync(path, 'utf8'));
  if (merged.kind === 'keep') return 'tsconfig.json já aponta para os tipos';
  if (merged.kind === 'warn') return merged.warning;
  writeFileSync(path, merged.content);
  return merged.warning;
};

/** `pptsx types [dir]`: só os tipos e o `typeRoots` do tsconfig, para um projeto que já tem deck (ou que atualizou o pptsx). */
export const runTypes = (args: TypesArgs): number => {
  mkdirSync(args.dir, { recursive: true });
  const written = writeTypes(args.dir, typesSourceDir());
  if (written === undefined) throw new Error(TYPES_MISSING_WARNING);
  console.log(`Tipos do pptsx ${written.version} em ${join(args.dir, written.dir)} (${written.count} arquivos); ${tsconfigNoteOf(args.dir).replace(/\.$/, '')}.`);
  return 0;
};

export const runInit = async (args: InitArgs, cwd: string): Promise<number> => {
  const plan = applyInit(args, args.ds === undefined ? undefined : await loadDsSource(args.ds, args.dir, cwd));
  // No --json o stdout é só o JSON; o aviso vai para stderr para não se perder.
  if (args.json) plan.warnings.forEach((warning) => console.error(`▲ ${warning}`));
  console.log(args.json ? initJsonOf(args.dir, plan) : initSummaryOf(args.dir, plan, cwd));
  return 0;
};
