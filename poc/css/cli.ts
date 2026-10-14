import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
import {
  deckNameOf,
  diagnosticsPathOf,
  errorMessageOf,
  exitCodeOf,
  filesOf,
  jsonErrorOf,
  jsonReportOf,
  listingOf,
  mergeOptions,
  outputPathsOf,
  parseCli,
  summaryOf,
  wantsJson,
} from '../../src/cli.ts';
import { defaultImportModule, type UserModule } from '../../src/cli/loader.ts';
import { assertDeckTsconfig, nearestTsconfigOf } from '../../src/cli/tsconfig.ts';
import { loadConfig } from '../../src/config.ts';
import type { DeckDefinition, Diagnostic as EngineDiagnostic } from '../../src/core/types.ts';
import { render } from './render.ts';

/**
 * Mini-CLI da PoC: `tsx poc/css/cli.ts build <deck.tsx> [--size 16x9,4x3] [--out dir]
 * [--debug] [--json] [--preview native|none]`. Mesmos argumentos, saídas e resumo da CLI da
 * engine (reaproveitados de src/cli.ts); muda só o render. Sem --watch nem init.
 */

const USAGE = 'uso: tsx poc/css/cli.ts build <deck.tsx> [--size 16x9,4x3,10x7.5in] [--out dir] [--debug] [--json] [--preview native|none] [--preview-width 1280]';

/**
 * O tsx só aplica um tsconfig aos arquivos do `include` dele: os decks de poc/css/examples
 * precisam do tsconfig da PoC, os de examples/ o da raiz. Um namespace do tsx com o tsconfig
 * mais próximo do deck resolve os dois.
 */
const importDeck = async (deckPath: string): Promise<UserModule> => {
  const tsconfig = nearestTsconfigOf(dirname(deckPath));
  const api = register({ namespace: `pptsx-poc-${Date.now()}`, ...(tsconfig === undefined ? {} : { tsconfig }) });
  try {
    return (await api.import(pathToFileURL(deckPath).href, import.meta.url)) as UserModule;
  } finally {
    await api.unregister();
  }
};

const loadDeck = async (deckPath: string): Promise<DeckDefinition> => {
  if (!existsSync(deckPath)) throw new Error(`deck não encontrado: ${deckPath}`);
  assertDeckTsconfig(deckPath);
  const module = await importDeck(deckPath);
  if (typeof module.default !== 'function') throw new Error(`${deckPath} precisa exportar default defineDeck(...)`);
  return module.default as DeckDefinition;
};

const build = async (argv: readonly string[], cwd: string): Promise<number> => {
  const args = parseCli(argv, cwd);
  const config = await loadConfig(cwd, { fresh: false, cwd }, defaultImportModule);
  const deck = await loadDeck(args.deckPath);
  const started = performance.now();
  const results = await render(deck, mergeOptions(args, config));
  const elapsed = performance.now() - started;
  const deckName = deckNameOf(args.deckPath);
  // O resumo e o JSON da CLI da engine só tratam `code` como texto: 'css-not-emitted' passa igual.
  const diagnostics = results.flatMap((result) => result.diagnostics) as unknown as readonly EngineDiagnostic[];
  mkdirSync(args.outDir, { recursive: true });
  const paths = results.map((result) => {
    const out = outputPathsOf(args.outDir, deckName, result.size, result.preview?.slides.length);
    writeFileSync(out.pptx, result.buffer);
    if (result.preview && out.slideDir && out.overview) {
      mkdirSync(out.slideDir, { recursive: true });
      result.preview.slides.forEach((png, index) => writeFileSync(out.slides[index]!, png));
      writeFileSync(out.overview, result.preview.overview);
    }
    return out;
  });
  const diagnosticsFile = diagnosticsPathOf(args.outDir, deckName);
  writeFileSync(diagnosticsFile, `${JSON.stringify(diagnostics, null, 2)}\n`);
  if (args.json) {
    console.log(jsonReportOf([...paths.flatMap(filesOf), diagnosticsFile], diagnostics));
    return exitCodeOf(diagnostics);
  }
  [...paths.flatMap(listingOf), diagnosticsFile].forEach((file) => console.log(file));
  console.log(`\n${summaryOf(diagnostics)}\n(render em ${Math.round(elapsed)} ms)`);
  return exitCodeOf(diagnostics);
};

export const runCli = async (argv: readonly string[], cwd: string = process.cwd()): Promise<number> => {
  try {
    if (argv[0] !== 'build') throw new Error(USAGE);
    return await build(argv, cwd);
  } catch (error) {
    if (wantsJson(argv)) console.log(jsonErrorOf(error));
    else console.error(errorMessageOf(error));
    return 1;
  }
};

const isEntryPoint = (): boolean => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
};

if (isEntryPoint()) process.exitCode = await runCli(process.argv.slice(2));
