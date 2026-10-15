import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'sucrase';

/**
 * M18-7: hooks de módulo do bundle de arquivo único (rodam na thread de hooks do Node, embutidos como
 * data: URL). Compilam o .ts/.tsx do usuário com o sucrase (JS puro, no lugar do tsx), apontam `pptsx`
 * e o runtime de JSX para o próprio bundle e propagam o `?pptsx-fresh=N` do --watch só para os arquivos
 * do usuário (como bin/fresh-hooks.mjs no build normal).
 */

interface HookData {
  readonly bundleUrl: string;
}

interface ResolveResult {
  readonly url: string;
  readonly format?: string | null;
  readonly shortCircuit?: boolean;
}

interface LoadResult {
  readonly format: string;
  readonly source?: string | ArrayBuffer | Uint8Array;
  readonly shortCircuit?: boolean;
}

type NextResolve = (specifier: string, context: { readonly parentURL?: string }) => Promise<ResolveResult>;
type NextLoad = (url: string, context: object) => Promise<LoadResult>;

const PARAM = 'pptsx-fresh';
const RUNTIME_SPECIFIERS: ReadonlySet<string> = new Set(['pptsx', 'pptsx/jsx-runtime', 'pptsx/jsx-dev-runtime']);
const TS_FILE = /\.[cm]?tsx?$/;

const state = { bundleUrl: '' };

export const initialize = async (data: HookData): Promise<void> => {
  state.bundleUrl = data.bundleUrl;
};

const versionOf = (url: string | undefined): string | undefined => {
  if (url === undefined) return undefined;
  try {
    return new URL(url).searchParams.get(PARAM) ?? undefined;
  } catch {
    return undefined;
  }
};

/** A URL sem query nem hash (o `origin` de file: é "null", não serve para remontar). */
const withoutQuery = (url: URL): URL => {
  const clean = new URL(url.href);
  clean.search = '';
  clean.hash = '';
  return clean;
};

const isUserFile = (url: URL): boolean =>
  url.protocol === 'file:' && !url.pathname.includes('/node_modules/') && withoutQuery(url).href !== withoutQuery(new URL(state.bundleUrl)).href;

export const resolve = async (specifier: string, context: { readonly parentURL?: string }, nextResolve: NextResolve): Promise<ResolveResult> => {
  if (RUNTIME_SPECIFIERS.has(specifier)) return { url: state.bundleUrl, format: 'module', shortCircuit: true };
  const result = await nextResolve(specifier, context);
  const version = versionOf(context.parentURL);
  if (version === undefined) return result;
  const url = new URL(result.url);
  if (!isUserFile(url) || url.searchParams.has(PARAM)) return result;
  url.searchParams.set(PARAM, version);
  return { ...result, url: url.href };
};

export const load = async (url: string, context: object, nextLoad: NextLoad): Promise<LoadResult> => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'file:' || !TS_FILE.test(parsed.pathname)) return nextLoad(url, context);
  const file = fileURLToPath(withoutQuery(parsed));
  const source = await readFile(file, 'utf8');
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx'],
    jsxRuntime: 'automatic',
    jsxImportSource: 'pptsx',
    production: true,
    disableESTransforms: true,
    filePath: file,
  });
  // Sempre ESM: o deck e a config do pptsx são módulos, qualquer que seja o "type" do package.json.
  return { format: 'module', source: code, shortCircuit: true };
};
