import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** O que o deck exige do tsconfig: o tsx usa essas chaves para compilar o JSX contra o pptsx. */
export const REQUIRED_JSX = 'react-jsx';
export const REQUIRED_JSX_IMPORT_SOURCE = 'pptsx';

type JsonObject = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

// tsconfig é JSONC: comentários e vírgula final são válidos. Varredura ciente de strings para não
// confundir "./src/*" ou "http://" com comentário.
const stripJsonc = (text: string): string => {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    const next = text[index + 1];
    if (char === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      out += text.slice(index, end + 1);
      index = end + 1;
    } else if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end === -1 ? text.length : end + 2;
    } else if (char === ',' && /^\s*[}\]]/.test(text.slice(index + 1))) {
      index += 1;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
};

/** JSON com comentários e vírgulas finais; undefined se não for um objeto válido. */
export const parseJsonc = (text: string): JsonObject | undefined => {
  try {
    const value: unknown = JSON.parse(stripJsonc(text));
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const tsconfigErrorOf = (deckPath: string): string =>
  `Não há tsconfig.json com jsx/jsxImportSource=pptsx para ${deckPath}; rode \`pptsx init\` no diretório do deck ` +
  `ou adicione compilerOptions.jsx = "${REQUIRED_JSX}" e jsxImportSource = "${REQUIRED_JSX_IMPORT_SOURCE}".`;

const compilerOptionsOf = (tsconfig: JsonObject): JsonObject =>
  isObject(tsconfig.compilerOptions) ? tsconfig.compilerOptions : {};

/**
 * O tsx só aplica um tsconfig aos arquivos do `include` dele: sem estas chaves no tsconfig do projeto o
 * deck compila como JSX clássico ("React is not defined"). Com `extends`, confia (não resolvemos a cadeia).
 */
export const tsconfigProblemOf = (tsconfig: unknown, deckPath: string = 'o deck'): string | undefined => {
  if (!isObject(tsconfig)) return tsconfigErrorOf(deckPath);
  if (tsconfig.extends !== undefined) return undefined;
  const options = compilerOptionsOf(tsconfig);
  if (options.jsx === undefined || options.jsxImportSource !== REQUIRED_JSX_IMPORT_SOURCE) return tsconfigErrorOf(deckPath);
  return undefined;
};

/** tsconfig.json mais próximo subindo a partir de `dir` (como o tsx/get-tsconfig o encontra). */
export const nearestTsconfigOf = (dir: string): string | undefined => {
  const candidate = join(dir, 'tsconfig.json');
  if (existsSync(candidate)) return candidate;
  const parent = dirname(dir);
  return parent === dir ? undefined : nearestTsconfigOf(parent);
};

/** Casca: falha com mensagem legível antes de o import do deck falhar de forma obscura. */
export const assertDeckTsconfig = (deckPath: string): void => {
  const file = nearestTsconfigOf(dirname(resolve(deckPath)));
  if (!file) throw new Error(tsconfigErrorOf(deckPath));
  const parsed = parseJsonc(readFileSync(file, 'utf8'));
  // tsconfig ilegível para nós pode ainda ser válido para o tsx: não bloqueia.
  if (parsed === undefined) return;
  const problem = tsconfigProblemOf(parsed, deckPath);
  if (problem) throw new Error(problem);
};

export type TsconfigMerge =
  | { readonly kind: 'write'; readonly content: string; readonly warning: string }
  | { readonly kind: 'keep' }
  | { readonly kind: 'warn'; readonly warning: string };

const hintOf = (): string =>
  `O deck precisa de compilerOptions.jsx = "${REQUIRED_JSX}" e jsxImportSource = "${REQUIRED_JSX_IMPORT_SOURCE}".`;

const REQUIRED_OPTIONS: Readonly<Record<string, string>> = {
  jsx: REQUIRED_JSX,
  jsxImportSource: REQUIRED_JSX_IMPORT_SOURCE,
};

/** tsconfig existente no `init`: completa jsx/jsxImportSource ausentes; valores diferentes ficam e geram aviso. */
export const mergeTsconfig = (existing: string): TsconfigMerge => {
  const tsconfig = parseJsonc(existing);
  if (!tsconfig) {
    return { kind: 'warn', warning: `tsconfig.json não é um JSON válido; mantido como está. ${hintOf()}` };
  }
  const options = compilerOptionsOf(tsconfig);
  const entries = Object.entries(REQUIRED_OPTIONS);
  const conflicts = entries.filter(([key, value]) => options[key] !== undefined && options[key] !== value);
  if (conflicts.length > 0) {
    const found = conflicts.map(([key]) => `${key} = ${JSON.stringify(options[key])}`).join(', ');
    return { kind: 'warn', warning: `tsconfig.json tem compilerOptions.${found}; mantido como está. ${hintOf()}` };
  }
  const missing = entries.filter(([key]) => options[key] === undefined);
  if (missing.length === 0) return { kind: 'keep' };
  const merged = { ...tsconfig, compilerOptions: { ...options, ...Object.fromEntries(missing) } };
  const added = missing.map(([key, value]) => `${key} = "${value}"`).join(' e ');
  return {
    kind: 'write',
    content: `${JSON.stringify(merged, null, 2)}\n`,
    warning: `tsconfig.json: adicionado compilerOptions.${added} (o deck compila o JSX contra o pptsx).`,
  };
};
