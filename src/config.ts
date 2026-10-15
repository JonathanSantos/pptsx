import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ImportModule, ImportOptions, UserModule } from './cli/loader.ts';
import type { DocumentProperties, FontFace, LineBreaks, SizeSpec, Theme } from './core/types.ts';
import type { DsManifest } from './ds.ts';
import type { LintRule } from './lint/rule.ts';

export const CONFIG_FILE_NAME = 'pptsx.config.ts';

export const LINE_BREAKS: readonly LineBreaks[] = ['forced', 'auto'];

export interface PptsxConfig {
  /** Substitui as fontes padrão (Liberation Sans como Arial), como em RenderOptions.fonts. */
  readonly fonts?: readonly FontFace[];
  readonly sizes?: readonly SizeSpec[];
  readonly lang?: string;
  readonly textSafety?: number;
  /** Como em RenderOptions.lineBreaks; a flag --line-breaks vence. */
  readonly lineBreaks?: LineBreaks;
  /** Como em RenderOptions.embedFonts; a flag --embed-fonts vence. */
  readonly embedFonts?: boolean;
  /** M15: tema de cores e fontes do arquivo, como em RenderOptions.theme. */
  readonly theme?: Theme;
  /** M15: propriedades do documento; sem `title`, a CLI usa o nome do arquivo do deck. */
  readonly document?: DocumentProperties;
  /** M17: regras de lint próprias e códigos desligados (os da engine ou de um DS). */
  readonly lint?: { readonly rules?: readonly LintRule[]; readonly disable?: readonly string[] };
  /** M17: design systems registrados (`defineDs`): regras no lint, guia e schema no MCP. */
  readonly ds?: readonly DsManifest[];
}

/** @deprecated Use PptsxConfig (nome antigo, de antes do pacote se chamar pptsx). */
export type TsxSlidesConfig = PptsxConfig;

/** Identidade tipada: só existe para o arquivo de config ganhar inferência. */
export const defineConfig = (config: PptsxConfig): PptsxConfig => config;

export const isLineBreaks = (value: unknown): value is LineBreaks => LINE_BREAKS.some((mode) => mode === value);

export const lineBreaksErrorOf = (source: string, value: unknown): string =>
  `${source} inválido: ${JSON.stringify(value)} (use ${LINE_BREAKS.join(' ou ')})`;

/** Caminhos de fonte na config são relativos ao arquivo de config, não ao cwd de quem roda a CLI. */
export const resolveConfigPaths = (config: PptsxConfig, configDir: string): PptsxConfig => {
  if (!config.fonts) return config;
  // Face sem `file` (M8) é resolvida no sistema pelo render; só caminhos relativos são ancorados aqui.
  const fonts = config.fonts.map((face) =>
    face.file === undefined || isAbsolute(face.file) ? face : { ...face, file: resolve(configDir, face.file) },
  );
  return { ...config, fonts };
};

const isConfigObject = (value: unknown): value is PptsxConfig =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A config é TS escrito à mão e pode chegar sem checagem de tipos (tsx só transpila).
const validateConfig = (config: PptsxConfig, file: string): PptsxConfig => {
  if (config.lineBreaks !== undefined && !isLineBreaks(config.lineBreaks)) {
    throw new Error(lineBreaksErrorOf(`${file}: lineBreaks`, config.lineBreaks));
  }
  return config;
};

export const configPathOf = (cwd: string): string => join(resolve(cwd), CONFIG_FILE_NAME);

// Sem tsx aqui: config.ts entra no grafo público (`defineConfig`) e não deve carregar o loader.
// A CLI injeta o importador com suporte a `fresh` (src/cli/loader.ts).
const plainImport: ImportModule = (file) => import(pathToFileURL(file).href) as Promise<UserModule>;

export const ESM_REQUIRED_MESSAGE =
  'O deck foi carregado como CommonJS, mas o pptsx usa top-level await e só roda como ESM: ' +
  'adicione "type": "module" ao package.json do projeto (`pptsx init` já cria assim).';

/** Erros do Node quando o deck foi transpilado para CJS e fez require() do pptsx (projeto sem "type": "module"). */
export const isRequireAsyncError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ERR_REQUIRE_ASYNC_MODULE' || error.message.includes('require() cannot be used on an ESM graph')) return true;
  // require() de um pacote só-ESM (exports sem `require`/`default`): mesma causa, deck carregado como CJS.
  return code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' && /node_modules[\\/]pptsx/.test(error.message);
};

/** Carga do deck/config com o erro de CommonJS traduzido para a correção que o usuário precisa fazer. */
export const importUserModule = async (
  file: string,
  options: ImportOptions = { fresh: false, cwd: process.cwd() },
  importModule: ImportModule = plainImport,
): Promise<UserModule> => {
  try {
    return await importModule(file, options);
  } catch (error) {
    if (!isRequireAsyncError(error)) throw error;
    throw new Error(`${file}: ${ESM_REQUIRED_MESSAGE}`, { cause: error });
  }
};

/** Carrega `pptsx.config.ts` de `cwd` (precisa rodar sob o loader do tsx); sem arquivo → {}. `fresh`: ver ImportOptions. */
export const loadConfig = async (
  cwd: string,
  options: ImportOptions = { fresh: false, cwd: process.cwd() },
  importModule: ImportModule = plainImport,
): Promise<PptsxConfig> => {
  const file = configPathOf(cwd);
  if (!existsSync(file)) return {};
  const module = await importUserModule(file, options, importModule);
  if (!isConfigObject(module.default)) throw new Error(`${file} precisa exportar default defineConfig({ ... })`);
  return resolveConfigPaths(validateConfig(module.default, file), dirname(file));
};
