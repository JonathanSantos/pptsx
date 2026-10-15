import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register as registerHooks } from 'node:module';
import { register } from 'tsx/esm/api';
import { nearestTsconfigOf } from './tsconfig.ts';

export interface UserModule {
  readonly default?: unknown;
}

export interface ImportOptions {
  /** true = grafo de módulos novo (deck e tudo que ele importa), isolado do cache ESM; usado pelo --watch. */
  readonly fresh: boolean;
  /** cwd do runCli: decide o tsconfig do namespace quando fresh. */
  readonly cwd: string;
}

/** Importa o deck/config do usuário; injetável em CliDeps para os testes não dependerem do tsx. */
export type ImportModule = (file: string, options: ImportOptions) => Promise<UserModule>;

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

// Mesma escolha do bin/pptsx.mjs: sem tsconfig no cwd, vale o do pacote (no repo, o de desenvolvimento,
// cujo `paths` aponta pptsx para src/). O namespace do tsx não herda o tsconfig do register global.
// O tsconfig do cwd de runCli vai explícito: o tsx procuraria pelo process.cwd(), que pode ser outro.
const tsconfigFor = (cwd: string): string => {
  const own = join(cwd, 'tsconfig.json');
  if (existsSync(own)) return own;
  const inRepo = existsSync(join(packageRoot, 'src', 'cli.ts'));
  return join(packageRoot, inRepo ? 'tsconfig.json' : 'tsconfig.deck.json');
};

/**
 * M16 (M9-E): o tsconfig que compila um arquivo do usuário é o mais próximo da pasta dele (o mesmo que
 * `assertDeckTsconfig` valida); sem nenhum acima, o do cwd/pacote.
 */
export const tsconfigForFile = (file: string, cwd: string): string => nearestTsconfigOf(dirname(resolve(file))) ?? tsconfigFor(cwd);

/** Raízes do motor (fonte e build do pacote): nunca recarregadas pelo `?pptsx-fresh`. */
const ENGINE_ROOTS = [pathToFileURL(join(packageRoot, 'src')).href + '/', pathToFileURL(join(packageRoot, 'dist')).href + '/'];

const freshHooks = { registered: false };

// M16 (M7-B): o `?pptsx-fresh=N` da entrada desce pelo grafo só nos arquivos do usuário (bin/fresh-hooks.mjs).
const ensureFreshHooks = (): void => {
  if (freshHooks.registered) return;
  registerHooks(new URL('../../bin/fresh-hooks.mjs', import.meta.url), { data: { engineRoots: ENGINE_ROOTS } });
  freshHooks.registered = true;
};

const createNamespace = (name: string, tsconfig: string) => register({ namespace: name, tsconfig });
type Namespace = ReturnType<typeof createNamespace>;

// Um namespace do tsx por tsconfig, reaproveitado: um namespace novo por rebuild recarregaria o motor
// inteiro (cada namespace tem cache próprio) e a memória do --watch crescia ~12 MB por build.
const namespaces = new Map<string, Namespace>();

const namespaceFor = (tsconfig: string): Namespace => {
  const existing = namespaces.get(tsconfig);
  if (existing !== undefined) return existing;
  const created = createNamespace(`pptsx-${namespaces.size + 1}`, tsconfig);
  namespaces.set(tsconfig, created);
  return created;
};

const freshCounter = { value: 0 };

const importFresh = async (file: string, tsconfig: string): Promise<UserModule> => {
  ensureFreshHooks();
  freshCounter.value += 1;
  const url = new URL(pathToFileURL(file).href);
  url.searchParams.set('pptsx-fresh', String(freshCounter.value));
  return (await namespaceFor(tsconfig).import(url.href, import.meta.url)) as UserModule;
};

/**
 * Padrão: `import()` normal (sem custo, compilado com o tsconfig do cwd pelo register global) ou um
 * namespace novo do tsx — com `fresh`, ou quando o arquivo tem tsconfig próprio diferente do do cwd
 * (deck fora do cwd com `jsxImportSource` próprio dava "React is not defined").
 */
export const defaultImportModule: ImportModule = (file, { fresh, cwd }) => {
  const tsconfig = tsconfigForFile(file, cwd);
  if (fresh || resolve(tsconfig) !== resolve(tsconfigFor(cwd))) return importFresh(file, tsconfig);
  return import(pathToFileURL(file).href) as Promise<UserModule>;
};
