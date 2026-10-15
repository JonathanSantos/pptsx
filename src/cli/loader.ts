import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

let namespaceCounter = 0;

// O `?v=` só furaria o cache do arquivo de entrada; o namespace do tsx recarrega o grafo inteiro
// (componentes, layouts, tokens). O hook sai logo após o import: o grafo já foi avaliado.
const importFresh = async (file: string, tsconfig: string): Promise<UserModule> => {
  namespaceCounter += 1;
  const api = register({ namespace: `pptsx-${Date.now()}-${namespaceCounter}`, tsconfig });
  try {
    return (await api.import(pathToFileURL(file).href, import.meta.url)) as UserModule;
  } finally {
    await api.unregister();
  }
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
