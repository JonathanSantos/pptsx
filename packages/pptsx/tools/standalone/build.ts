import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';

/**
 * M18-7: `npm run build:standalone` — o núcleo inteiro em `dist/standalone/pptsx.mjs`, um ESM só, para
 * rodar com Node 20+ sem node_modules: yoga (wasm, já embutido no pacote dele), as Liberation Sans e o
 * resvg-wasm em base64, o sucrase nos hooks que compilam o deck. O build normal (dist/, bin/, tsx,
 * resvg-js) não muda. Grava também o SHA256SUMS ao lado.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'dist', 'standalone');
const outFile = join(outDir, 'pptsx.mjs');
const require = createRequire(import.meta.url);

const base64Of = (file: string): string => readFileSync(file).toString('base64');

const bundleHooks = async (): Promise<string> => {
  const result = await build({
    entryPoints: [join(here, 'hooks.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    minify: true,
    write: false,
  });
  return result.outputFiles[0]!.text;
};

const assetsModule = (hooksSource: string): string => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { readonly version: string };
  const fontsDir = join(root, 'fonts');
  const fonts = Object.fromEntries(readdirSync(fontsDir).filter((name) => /^LiberationSans-.*\.ttf$/.test(name)).map((name) => [name, base64Of(join(fontsDir, name))]));
  const wasm = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
  return [
    `export const VERSION = ${JSON.stringify(pkg.version)};`,
    `export const GUIDE = ${JSON.stringify(readFileSync(join(root, 'docs', 'AGENT_GUIDE.md'), 'utf8'))};`,
    `export const HOOKS_SOURCE = ${JSON.stringify(hooksSource)};`,
    `export const RESVG_WASM_BASE64 = ${JSON.stringify(base64Of(wasm))};`,
    `export const FONTS = ${JSON.stringify(fonts)};`,
  ].join('\n');
};

// Os trocados: addon nativo → wasm; tsx → hooks com sucrase; e o módulo virtual dos assets.
const standalonePlugin = (hooksSource: string): Plugin => ({
  name: 'pptsx-standalone',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@resvg\/resvg-js$/ }, () => ({ path: join(here, 'shim-resvg.ts') }));
    pluginBuild.onResolve({ filter: /^tsx\/esm\/api$/ }, () => ({ path: join(here, 'shim-tsx.ts') }));
    pluginBuild.onResolve({ filter: /^pptsx-standalone:assets$/ }, () => ({ path: 'assets', namespace: 'pptsx-standalone' }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'pptsx-standalone' }, () => ({ contents: assetsModule(hooksSource), loader: 'js' }));
  },
});

// Dependências CJS (pptxgenjs, fontkit…) usam require/__dirname: num ESM eles não existem.
const BANNER = [
  '#!/usr/bin/env node',
  "import { createRequire as __pptsxCreateRequire } from 'node:module';",
  "import { fileURLToPath as __pptsxFileURLToPath } from 'node:url';",
  "import { dirname as __pptsxDirname } from 'node:path';",
  'const require = __pptsxCreateRequire(import.meta.url);',
  'const __filename = __pptsxFileURLToPath(import.meta.url);',
  'const __dirname = __pptsxDirname(__filename);',
].join('\n');

const main = async (): Promise<void> => {
  mkdirSync(outDir, { recursive: true });
  const hooksSource = await bundleHooks();
  await build({
    entryPoints: [join(here, 'entry.ts')],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    minifyWhitespace: true,
    minifySyntax: true,
    legalComments: 'eof',
    banner: { js: BANNER },
    // O `--fix` carrega a API do TypeScript do projeto do usuário, se houver (import por nome).
    external: ['typescript', 'typescript-api'],
    plugins: [standalonePlugin(hooksSource)],
    logLevel: 'warning',
  });
  const sum = createHash('sha256').update(readFileSync(outFile)).digest('hex');
  writeFileSync(join(outDir, 'SHA256SUMS'), `${sum}  pptsx.mjs\n`);
  console.log(`${outFile} (${(statSync(outFile).size / 1024 / 1024).toFixed(1)} MB)\nsha256 ${sum}`);
};

await main();
