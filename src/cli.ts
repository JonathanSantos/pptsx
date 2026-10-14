import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { INIT_USAGE, parseInitCli, runInit } from './cli/init.ts';
import { defaultImportModule, type ImportModule, type ImportOptions } from './cli/loader.ts';
import { assertDeckTsconfig } from './cli/tsconfig.ts';
import { createFsWatch, runWatchLoop, stampLine, watchPathsOf, type WatchFn } from './cli/watch.ts';
import { configPathOf, importUserModule, isLineBreaks, lineBreaksErrorOf, loadConfig, type PptsxConfig } from './config.ts';
import { DEFAULTS } from './core/defaults.ts';
import type { DeckDefinition, Diagnostic, LineBreaks, RenderOptions, RenderResult, Severity, SizeSpec } from './core/types.ts';
import { render } from './render.ts';
import { parseSizeList } from './sizes.ts';

export const USAGE = [
  'uso: pptsx build <deck.tsx> [--size 16x9,4x3,10x7.5in] [--out dist/] [--debug] [--json] ' +
    '[--preview native|none] [--preview-width 1280] [--lang pt-BR] [--line-breaks forced|auto] [--embed-fonts] [--watch]',
  `     ${INIT_USAGE.replace(/^uso: /, '')}`,
].join('\n');

/** Dependências de IO trocáveis (testes): observação de arquivos e o sinal que encerra o --watch. */
export interface CliDeps {
  /** Padrão: fs.watch recursivo, ignorando o diretório de saída. */
  readonly watch?: WatchFn;
  /** Padrão: aborta em SIGINT/SIGTERM (Ctrl-C sai com 0). */
  readonly signal?: AbortSignal;
  /** Carga do deck e da config. Padrão: import() normal; no --watch, namespace novo do tsx a cada build. */
  readonly importModule?: ImportModule;
}

export interface CliArgs {
  readonly deckPath: string;
  readonly outDir: string;
  /** undefined = flag ausente, para a config poder preencher. */
  readonly sizes?: readonly SizeSpec[];
  readonly lang?: string;
  readonly debug: boolean;
  readonly json: boolean;
  readonly preview: boolean;
  readonly previewWidth: number;
  /** undefined = flag ausente, para a config poder preencher. */
  readonly lineBreaks?: LineBreaks;
  /** undefined = flag ausente, para a config poder preencher. */
  readonly embedFonts?: boolean;
  readonly watch: boolean;
}

/** Arquivos de um tamanho na árvore da spec. */
export interface OutputPaths {
  readonly pptx: string;
  readonly overview?: string;
  readonly slideDir?: string;
  readonly slides: readonly string[];
}

export interface JsonReport {
  readonly files: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  /** M8: faces pedidas sem arquivo e não achadas no sistema; ausente quando vazio. */
  readonly fontsMissing?: readonly string[];
}

// ---------- parsing ----------

const parsePreviewMode = (mode: string): boolean => {
  if (mode === 'native') return true;
  if (mode === 'none') return false;
  throw new Error(`--preview inválido: "${mode}" (use native ou none)`);
};

export const parsePreviewWidth = (raw: string): number => {
  const width = Number(raw);
  if (!/^\d+$/.test(raw) || width <= 0) {
    throw new Error(`--preview-width inválido: "${raw}" (use um inteiro positivo em px, ex.: 1280)`);
  }
  return width;
};

export const parseLineBreaks = (raw: string): LineBreaks => {
  if (!isLineBreaks(raw)) throw new Error(lineBreaksErrorOf('--line-breaks', raw));
  return raw;
};

export const parseCli = (argv: readonly string[], cwd: string = process.cwd()): CliArgs => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      size: { type: 'string' },
      out: { type: 'string', default: 'dist' },
      debug: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      preview: { type: 'string', default: 'native' },
      'preview-width': { type: 'string', default: String(DEFAULTS.preview.width) },
      lang: { type: 'string' },
      'line-breaks': { type: 'string' },
      watch: { type: 'boolean', default: false },
      'embed-fonts': { type: 'boolean', default: false },
    },
  });
  const [command, deckPath] = positionals;
  if (command !== 'build' || !deckPath) throw new Error(USAGE);
  return {
    deckPath: resolve(cwd, deckPath),
    outDir: resolve(cwd, values.out),
    sizes: values.size === undefined ? undefined : parseSizeList(values.size),
    lang: values.lang,
    debug: values.debug,
    json: values.json,
    preview: parsePreviewMode(values.preview),
    previewWidth: parsePreviewWidth(values['preview-width']),
    lineBreaks: values['line-breaks'] === undefined ? undefined : parseLineBreaks(values['line-breaks']),
    embedFonts: values['embed-fonts'] ? true : undefined,
    watch: values.watch,
  };
};

/** Usado quando o parse falha: ainda assim o agente que pediu --json deve receber JSON. */
export const wantsJson = (argv: readonly string[]): boolean => argv.includes('--json');

// ---------- opções ----------

/** Flags da CLI vencem a config; o que nenhum dos dois define fica com o padrão do render. */
export const mergeOptions = (args: CliArgs, config: PptsxConfig): RenderOptions => ({
  sizes: args.sizes ?? config.sizes,
  fonts: config.fonts,
  lang: args.lang ?? config.lang,
  textSafety: config.textSafety,
  lineBreaks: args.lineBreaks ?? config.lineBreaks,
  embedFonts: args.embedFonts ?? config.embedFonts,
  debug: args.debug,
  baseDir: dirname(args.deckPath),
  preview: args.preview ? { mode: 'native', width: args.previewWidth } : false,
});

// ---------- caminhos de saída ----------

export const deckNameOf = (deckPath: string): string => basename(deckPath, extname(deckPath));

const slideFileName = (index: number): string => `slide-${String(index + 1).padStart(2, '0')}.png`;

/** Estrutura da spec: <deck>.<size>.pptx, <deck>.<size>.overview.png, <deck>.<size>/slide-NN.png */
export const outputPathsOf = (outDir: string, deckName: string, size: string, slideCount?: number): OutputPaths => {
  const prefix = join(outDir, `${deckName}.${size}`);
  const pptx = `${prefix}.pptx`;
  if (slideCount === undefined) return { pptx, slides: [] };
  return {
    pptx,
    overview: `${prefix}.overview.png`,
    slideDir: prefix,
    slides: Array.from({ length: slideCount }, (_, index) => join(prefix, slideFileName(index))),
  };
};

export const diagnosticsPathOf = (outDir: string, deckName: string): string => join(outDir, `${deckName}.diagnostics.json`);

/** Lista completa de arquivos (para --json). */
export const filesOf = (paths: OutputPaths): readonly string[] =>
  [paths.pptx, paths.overview, ...paths.slides].filter((file): file is string => file !== undefined);

/** Lista resumida (para humanos): a pasta de PNGs vira uma linha só. */
export const listingOf = (paths: OutputPaths): readonly string[] => {
  if (!paths.overview || !paths.slideDir) return [paths.pptx];
  return [paths.pptx, paths.overview, `${paths.slideDir}/ (${paths.slides.length} PNGs)`];
};

const pathsOfResult = (outDir: string, deckName: string, result: RenderResult): OutputPaths =>
  outputPathsOf(outDir, deckName, result.size, result.preview?.slides.length);

// ---------- relatório ----------

const SEVERITY_ICON: Readonly<Record<Severity, string>> = { error: '✖', warning: '▲', info: '•' };

const formatDiagnostic = (d: Diagnostic, indent: string = '  ', marker: string = ''): string =>
  `${indent}${marker}${SEVERITY_ICON[d.severity]} [${d.size} · slide ${d.slide}] ${d.code} em ${d.path}\n${indent}  ${d.message}`;

const formatDerived = (d: Diagnostic): string => formatDiagnostic(d, '    ', '↳ ');

/** Uma causa (ou diagnóstico solto) e os derivados que o resumo imprime logo abaixo dela. */
export interface DiagnosticGroup {
  readonly diagnostic: Diagnostic;
  readonly derived: readonly Diagnostic[];
}

export const isDerived = (d: Diagnostic): boolean => d.data?.causedBy !== undefined;

const sameSlide = (a: Diagnostic, b: Diagnostic): boolean => a.size === b.size && a.slide === b.slide;

const isExactCauseOf = (cause: Diagnostic, derived: Diagnostic): boolean => cause.path === derived.data?.causedBy;

// A causa costuma ser um Box sem diagnóstico próprio; o estouro real está num descendente dele.
const isInsideCauseOf = (cause: Diagnostic, derived: Diagnostic): boolean =>
  derived.data?.causedBy !== undefined && cause.path.startsWith(`${derived.data.causedBy} > `);

/** Só não derivados ancoram: assim todo derivado fica a um nível de `↳`, sem cadeias nem ciclos. */
export const isCauseOf = (cause: Diagnostic, derived: Diagnostic): boolean =>
  isDerived(derived) &&
  !isDerived(cause) &&
  sameSlide(cause, derived) &&
  (isExactCauseOf(cause, derived) || isInsideCauseOf(cause, derived));

// Índice (não o objeto) porque a causa pode ter vários diagnósticos; vale o primeiro de path exato, senão o
// primeiro dentro dela. -1 = imprime no lugar normal.
const causeIndexOf = (diagnostics: readonly Diagnostic[], index: number): number => {
  const derived = diagnostics[index]!;
  const candidates = (match: (cause: Diagnostic) => boolean): number =>
    diagnostics.findIndex((cause) => isCauseOf(cause, derived) && match(cause));
  const exact = candidates((cause) => isExactCauseOf(cause, derived));
  return exact !== -1 ? exact : candidates((cause) => isInsideCauseOf(cause, derived));
};

/** Não derivados (e derivados órfãos) na ordem original, cada um seguido dos seus derivados na ordem original. */
export const groupByCause = (diagnostics: readonly Diagnostic[]): readonly DiagnosticGroup[] => {
  const anchors = diagnostics.map((_, index) => causeIndexOf(diagnostics, index));
  return diagnostics.flatMap((diagnostic, index) => {
    if (anchors[index] !== -1) return [];
    const derived = diagnostics.filter((_, other) => anchors[other] === index);
    return [{ diagnostic, derived }];
  });
};

const formatGroup = (group: DiagnosticGroup): readonly string[] => [
  formatDiagnostic(group.diagnostic),
  ...group.derived.map(formatDerived),
];

// Derivados somem da contagem para o cabeçalho mostrar quantos problemas há de fato para corrigir.
const headerOf = (diagnostics: readonly Diagnostic[]): string => {
  const primary = diagnostics.filter((d) => !isDerived(d));
  const derivedCount = diagnostics.length - primary.length;
  const count = (severity: Severity) => primary.filter((d) => d.severity === severity).length;
  const derivedNote = derivedCount > 0 ? ` (+${derivedCount} ${derivedCount === 1 ? 'derivado' : 'derivados'})` : '';
  return `Diagnósticos: ${count('error')} error${derivedNote}, ${count('warning')} warning, ${count('info')} info`;
};

export const summaryOf = (diagnostics: readonly Diagnostic[]): string => {
  if (diagnostics.length === 0) return 'Nenhum diagnóstico.';
  return [headerOf(diagnostics), ...groupByCause(diagnostics).flatMap(formatGroup)].join('\n');
};

// Código de saída 1 com qualquer error: agentes e CI dependem disso.
export const exitCodeOf = (diagnostics: readonly Diagnostic[]): 0 | 1 =>
  diagnostics.some((d) => d.severity === 'error') ? 1 : 0;

const reportOf = (files: readonly string[], diagnostics: readonly Diagnostic[], fontsMissing?: readonly string[]): JsonReport =>
  fontsMissing && fontsMissing.length > 0 ? { files, diagnostics, fontsMissing } : { files, diagnostics };

export const jsonReportOf = (files: readonly string[], diagnostics: readonly Diagnostic[], fontsMissing?: readonly string[]): string =>
  JSON.stringify(reportOf(files, diagnostics, fontsMissing), null, 2);

/** Uma linha por build no --watch --json (NDJSON). */
export const jsonLineOf = (files: readonly string[], diagnostics: readonly Diagnostic[], fontsMissing?: readonly string[]): string =>
  JSON.stringify(reportOf(files, diagnostics, fontsMissing));

/** Linha do resumo humano para fontes pedidas sem arquivo e não achadas no sistema. */
export const fontsMissingLineOf = (fontsMissing: readonly string[] | undefined): string | undefined =>
  fontsMissing && fontsMissing.length > 0 ? `▲ fontes não encontradas no sistema: ${fontsMissing.join(', ')}` : undefined;

export const errorMessageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const jsonErrorOf = (error: unknown): string => JSON.stringify({ error: errorMessageOf(error) });

// ---------- IO ----------

const loadDeck = async (deckPath: string, options: ImportOptions, importModule: ImportModule): Promise<DeckDefinition> => {
  if (!existsSync(deckPath)) throw new Error(`deck não encontrado: ${deckPath}`);
  assertDeckTsconfig(deckPath);
  const module = await importUserModule(deckPath, options, importModule);
  if (typeof module.default !== 'function') throw new Error(`${deckPath} precisa exportar default defineDeck(...)`);
  return module.default as DeckDefinition;
};

const writeResult = (paths: OutputPaths, result: RenderResult): void => {
  writeFileSync(paths.pptx, result.buffer);
  if (!result.preview || !paths.overview || !paths.slideDir) return;
  mkdirSync(paths.slideDir, { recursive: true });
  result.preview.slides.forEach((png, index) => writeFileSync(paths.slides[index]!, png));
  writeFileSync(paths.overview, result.preview.overview);
};

interface BuildOutcome {
  /** Lista completa (--json). */
  readonly files: readonly string[];
  /** Lista resumida (humanos). */
  readonly listing: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  readonly fontsMissing?: readonly string[];
}

/** Um build completo, gravando tudo em disco. `fresh` recarrega deck, config e o que eles importam. */
const buildOnce = async (args: CliArgs, cwd: string, deps: CliDeps, fresh: boolean): Promise<BuildOutcome> => {
  const importModule = deps.importModule ?? defaultImportModule;
  const config = await loadConfig(cwd, { fresh, cwd }, importModule);
  const deck = await loadDeck(args.deckPath, { fresh, cwd }, importModule);
  const results = await render(deck, mergeOptions(args, config));
  const deckName = deckNameOf(args.deckPath);
  const diagnostics = results.flatMap((result) => result.diagnostics);
  const pathsPerSize = results.map((result) => pathsOfResult(args.outDir, deckName, result));
  const diagnosticsFile = diagnosticsPathOf(args.outDir, deckName);

  mkdirSync(args.outDir, { recursive: true });
  results.forEach((result, index) => writeResult(pathsPerSize[index]!, result));
  writeFileSync(diagnosticsFile, `${JSON.stringify(diagnostics, null, 2)}\n`);

  // A lista é a mesma em todos os tamanhos: basta a do primeiro resultado.
  const fontsMissing = results[0]?.fontsMissing;
  return {
    files: [...pathsPerSize.flatMap(filesOf), diagnosticsFile],
    listing: [...pathsPerSize.flatMap(listingOf), diagnosticsFile],
    diagnostics,
    ...(fontsMissing && fontsMissing.length > 0 ? { fontsMissing } : {}),
  };
};

const build = async (args: CliArgs, cwd: string, deps: CliDeps): Promise<number> => {
  const outcome = await buildOnce(args, cwd, deps, false);
  if (args.json) {
    console.log(jsonReportOf(outcome.files, outcome.diagnostics, outcome.fontsMissing));
    return exitCodeOf(outcome.diagnostics);
  }
  outcome.listing.forEach((file) => console.log(file));
  const fontsLine = fontsMissingLineOf(outcome.fontsMissing);
  console.log(`\n${summaryOf(outcome.diagnostics)}${fontsLine ? `\n${fontsLine}` : ''}`);
  return exitCodeOf(outcome.diagnostics);
};

const reportWatchBuild = (args: CliArgs, outcome: BuildOutcome, at: Date): void => {
  if (args.json) return console.log(jsonLineOf(outcome.files, outcome.diagnostics, outcome.fontsMissing));
  outcome.listing.forEach((file) => console.log(file));
  console.log(`${stampLine(at, summaryOf(outcome.diagnostics))}\n`);
};

// No --watch um erro (sintaxe, estrutura, deck ausente) é só mais um resultado: o watch continua.
const reportWatchError = (args: CliArgs, error: unknown, at: Date): void => {
  if (args.json) return console.log(jsonErrorOf(error));
  console.error(stampLine(at, `erro: ${errorMessageOf(error)}\n`));
};

/** Sem sinal injetado, Ctrl-C (SIGINT) ou SIGTERM encerra o watch com código 0. */
const withStopSignal = async (signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<void>): Promise<void> => {
  if (signal) return run(signal);
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    await run(controller.signal);
  } finally {
    process.off('SIGINT', abort);
    process.off('SIGTERM', abort);
  }
};

const watchBuild = async (args: CliArgs, cwd: string, deps: CliDeps): Promise<number> => {
  const rebuild = async (): Promise<void> => {
    try {
      reportWatchBuild(args, await buildOnce(args, cwd, deps, true), new Date());
    } catch (error) {
      reportWatchError(args, error, new Date());
    }
  };
  const paths = watchPathsOf(args.deckPath, configPathOf(cwd));
  if (!args.json) console.log(stampLine(new Date(), `observando ${paths.join(', ')} (Ctrl-C para sair)`));
  const watch = deps.watch ?? createFsWatch([args.outDir]);
  await withStopSignal(deps.signal, (signal) => runWatchLoop({ paths, watch, signal, rebuild }));
  return 0;
};

/** Primeiro argumento que não é flag; os comandos vêm antes das flags (`pptsx build ...`). */
export const commandOf = (argv: readonly string[]): string | undefined => argv.find((arg) => !arg.startsWith('-'));

export const wantsHelp = (argv: readonly string[]): boolean => argv.includes('--help') || argv.includes('-h');

export const wantsVersion = (argv: readonly string[]): boolean => argv.includes('--version');

// Um nível acima tanto de src/cli.ts quanto de dist/cli.js fica o package.json do pacote.
const packageVersion = (): string => {
  const pkg: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const version = typeof pkg === 'object' && pkg !== null && 'version' in pkg ? pkg.version : undefined;
  if (typeof version !== 'string') throw new Error('package.json do pptsx sem "version"');
  return version;
};

const dispatch = async (argv: readonly string[], cwd: string, deps: CliDeps): Promise<number> => {
  if (wantsHelp(argv)) {
    console.log(USAGE);
    return 0;
  }
  if (wantsVersion(argv)) {
    console.log(packageVersion());
    return 0;
  }
  if (commandOf(argv) === 'init') return runInit(parseInitCli(argv, cwd), cwd);
  const args = parseCli(argv, cwd);
  return args.watch ? watchBuild(args, cwd, deps) : build(args, cwd, deps);
};

/** Casca de IO: devolve o código de saída em vez de chamar process.exit. */
export const runCli = async (argv: readonly string[], cwd: string = process.cwd(), deps: CliDeps = {}): Promise<number> => {
  try {
    return await dispatch(argv, cwd, deps);
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

// Só roda quando executado direto (`tsx src/cli.ts`); importar o módulo (bin, testes) não dispara nada.
if (isEntryPoint()) process.exitCode = await runCli(process.argv.slice(2));
