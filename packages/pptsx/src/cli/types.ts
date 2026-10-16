import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { standaloneRuntime } from '../standalone.ts';

/**
 * 1.0.5: os `.d.ts` do pptsx copiados para `.pptsx/types/pptsx/` na pasta do deck, como um pacote de tipos num
 * `typeRoots` do `tsconfig.json`. O editor entende `import … from 'pptsx'` e o JSX sem depender do `node_modules`
 * (o mesmo que o `pptsx-rs init` faz, lá sem npm nenhum).
 *
 * Por que `typeRoots` e não `paths`: o tsx (que roda o deck) segue o `paths` e carregaria o `.d.ts` no lugar do
 * pacote, quebrando o build; `typeRoots` só o TypeScript lê, e com `node_modules/pptsx` presente o pacote
 * instalado vence (tipos nunca ficam velhos por causa da cópia). O `typeRoots` resolve só o nome do pacote, então
 * `pptsx/jsx-runtime` e `pptsx/jsx-dev-runtime` saem como declarações ambientes (`jsx-shim.d.ts`, gerado dos
 * próprios `.d.ts`) referenciadas pela entrada do pacote. IO de borda: só o `init`/`types` chamam.
 */

export const TYPES_ROOT = '.pptsx/types';
export const TYPES_DIR = `${TYPES_ROOT}/pptsx`;

/** `compilerOptions.typeRoots` do scaffold: a cópia local e o padrão do TypeScript (que some quando a opção é definida). */
export const TYPE_ROOTS: readonly string[] = [`./${TYPES_ROOT}`, './node_modules/@types'];

const JSX_RUNTIME = 'jsx/jsx-runtime.d.ts';
const JSX_DEV_RUNTIME = 'jsx/jsx-dev-runtime.d.ts';

const indent = (text: string): string =>
  text
    .trim()
    .split('\n')
    .map((line) => (line.trim() === '' ? line : `  ${line}`))
    .join('\n');

/** Os dois módulos do JSX como `declare module`, importando do próprio `pptsx` o que importavam por caminho relativo. */
export const jsxShimOf = (jsxRuntime: string, jsxDevRuntime: string): string => {
  const runtime = jsxRuntime.replaceAll("'../core/types.ts'", "'pptsx'").replace('export {};', '');
  const dev = jsxDevRuntime.replaceAll("'./jsx-runtime.ts'", "'pptsx/jsx-runtime'");
  return [
    '// Gerado por `pptsx types`: o typeRoots resolve só o nome do pacote; os módulos do JSX entram como declarações ambientes.',
    "declare module 'pptsx/jsx-runtime' {",
    indent(runtime),
    '}',
    "declare module 'pptsx/jsx-dev-runtime' {",
    indent(dev),
    '}',
    '',
  ].join('\n');
};

const ENTRY = "/// <reference path=\"./jsx-shim.d.ts\" />\nexport * from './index.ts';\n";
const PACKAGE = '{ "name": "pptsx", "types": "./entry.d.ts" }\n';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

/** `dist/` do pacote (instalado ou, no repo, depois de `npm run build`); ausente quando não há `.d.ts` para copiar. */
export const typesSourceDir = (): string | undefined => {
  const dist = join(packageRoot, 'dist');
  return existsSync(join(dist, 'index.d.ts')) ? dist : undefined;
};

/** Caminhos relativos (com `/`) de todo `.d.ts` abaixo de `root`, em ordem alfabética. */
export const declarationFilesOf = (root: string, dir: string = root): readonly string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return declarationFilesOf(root, path);
      return entry.name.endsWith('.d.ts') ? [relative(root, path).split(sep).join('/')] : [];
    })
    .sort();

const versionOf = (): string => {
  const runtime = standaloneRuntime();
  if (runtime !== undefined) return runtime.version;
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { readonly version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : '?';
};

export const typesReadmeOf = (version: string): string =>
  `Tipos do pptsx ${version} para o editor (typeRoots do tsconfig.json), gravados por \`pptsx init\`/\`pptsx types\`. Com o pptsx instalado em node_modules, o editor usa o pacote; esta cópia vale quando ele não está. Não edite: \`pptsx types\` regrava.\n`;

export interface TypesWritten {
  /** Relativo à pasta do projeto (TYPES_DIR). */
  readonly dir: string;
  readonly count: number;
  readonly version: string;
}

export const TYPES_MISSING_WARNING =
  'tipos do pptsx não gravados: o pacote não tem dist/ com os .d.ts (no repo, rode `npm run build`; no bundle de arquivo único, `npm install pptsx` dá os tipos ao editor).';

/** Copia os `.d.ts` de `source` (normalmente `typesSourceDir()`) para `<projectDir>/.pptsx/types/pptsx/` e grava o README. */
export const writeTypes = (projectDir: string, source: string | undefined): TypesWritten | undefined => {
  if (source === undefined) return undefined;
  const target = join(projectDir, TYPES_DIR);
  const files = declarationFilesOf(source);
  files.forEach((file) => {
    const to = join(target, file);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(join(source, file)));
  });
  const version = versionOf();
  mkdirSync(target, { recursive: true });
  const read = (file: string): string => readFileSync(join(source, file), 'utf8');
  writeFileSync(join(target, 'jsx-shim.d.ts'), jsxShimOf(read(JSX_RUNTIME), read(JSX_DEV_RUNTIME)));
  writeFileSync(join(target, 'entry.d.ts'), ENTRY);
  writeFileSync(join(target, 'package.json'), PACKAGE);
  writeFileSync(join(target, 'README.md'), typesReadmeOf(version));
  return { dir: TYPES_DIR, count: files.length, version };
};

/** A linha do resumo do `init`/`types`. */
export const typesLineOf = (written: TypesWritten): string =>
  `${written.dir}/ (${written.count} .d.ts do pptsx ${written.version}; typeRoots do tsconfig: o editor entende o deck sem npm install)`;
