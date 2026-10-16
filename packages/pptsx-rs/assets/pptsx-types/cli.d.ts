import { MIGRATION_SOURCES } from './cli/migrate.ts';
import { type ImportModule, type ImportOptions } from './cli/loader.ts';
import { type PreviewState } from './cli/preview/state.ts';
import { type WatchFn } from './cli/watch.ts';
import { type PptsxConfig } from './config.ts';
import type { DeckDefinition, Diagnostic, LineBreaks, RenderOptions, SizeSpec } from './core/types.ts';
export declare const USAGE: string;
/** Dependências de IO trocáveis (testes): observação de arquivos e o sinal que encerra o --watch. */
export interface CliDeps {
    /** Padrão: fs.watch recursivo, ignorando o diretório de saída. */
    readonly watch?: WatchFn;
    /** Padrão: aborta em SIGINT/SIGTERM (Ctrl-C sai com 0). */
    readonly signal?: AbortSignal;
    /** Carga do deck e da config. Padrão: import() normal; no --watch, namespace novo do tsx a cada build. */
    readonly importModule?: ImportModule;
    /** M16-4: avisado quando o `preview --serve` começa a escutar (a URL com a porta real). */
    readonly onListening?: (url: string) => void;
    /** M16-4: avisado depois de cada rebuild do `preview --serve` (testes esperam por ele). */
    readonly onRebuild?: (state: PreviewState) => void;
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
export declare const parsePreviewWidth: (raw: string) => number;
export declare const parseLineBreaks: (raw: string) => LineBreaks;
export declare const parseCli: (argv: readonly string[], cwd?: string) => CliArgs;
/** Usado quando o parse falha: ainda assim o agente que pediu --json deve receber JSON. */
export declare const wantsJson: (argv: readonly string[]) => boolean;
/** Flags da CLI vencem a config; o que nenhum dos dois define fica com o padrão do render. */
export declare const mergeOptions: (args: CliArgs, config: PptsxConfig) => RenderOptions;
export declare const deckNameOf: (deckPath: string) => string;
/** Estrutura da spec: <deck>.<size>.pptx, <deck>.<size>.overview.png, <deck>.<size>/slide-NN.png */
export declare const outputPathsOf: (outDir: string, deckName: string, size: string, slideCount?: number) => OutputPaths;
export declare const diagnosticsPathOf: (outDir: string, deckName: string) => string;
/** Lista completa de arquivos (para --json). */
export declare const filesOf: (paths: OutputPaths) => readonly string[];
/** Lista resumida (para humanos): a pasta de PNGs vira uma linha só. */
export declare const listingOf: (paths: OutputPaths) => readonly string[];
/** Uma causa (ou diagnóstico solto) e os derivados que o resumo imprime logo abaixo dela. */
export interface DiagnosticGroup {
    readonly diagnostic: Diagnostic;
    readonly derived: readonly Diagnostic[];
}
export declare const isDerived: (d: Diagnostic) => boolean;
/** Só não derivados ancoram: assim todo derivado fica a um nível de `↳`, sem cadeias nem ciclos. */
export declare const isCauseOf: (cause: Diagnostic, derived: Diagnostic) => boolean;
/** Não derivados (e derivados órfãos) na ordem original, cada um seguido dos seus derivados na ordem original. */
export declare const groupByCause: (diagnostics: readonly Diagnostic[]) => readonly DiagnosticGroup[];
export declare const summaryOf: (diagnostics: readonly Diagnostic[]) => string;
export declare const exitCodeOf: (diagnostics: readonly Diagnostic[]) => 0 | 1;
export declare const jsonReportOf: (files: readonly string[], diagnostics: readonly Diagnostic[], fontsMissing?: readonly string[]) => string;
/** Uma linha por build no --watch --json (NDJSON). */
export declare const jsonLineOf: (files: readonly string[], diagnostics: readonly Diagnostic[], fontsMissing?: readonly string[]) => string;
/** Linha do resumo humano para fontes pedidas sem arquivo e não achadas no sistema. */
export declare const fontsMissingLineOf: (fontsMissing: readonly string[] | undefined) => string | undefined;
export declare const errorMessageOf: (error: unknown) => string;
export declare const jsonErrorOf: (error: unknown) => string;
export declare const loadDeck: (deckPath: string, options: ImportOptions, importModule: ImportModule) => Promise<DeckDefinition>;
export interface BuildOutcome {
    /** Lista completa (--json). */
    readonly files: readonly string[];
    /** Lista resumida (humanos). */
    readonly listing: readonly string[];
    readonly diagnostics: readonly Diagnostic[];
    readonly fontsMissing?: readonly string[];
}
/** Um build completo, gravando tudo em disco. `fresh` recarrega deck, config e o que eles importam. */
export declare const buildOnce: (args: CliArgs, cwd: string, deps: CliDeps, fresh: boolean) => Promise<BuildOutcome>;
export interface PreviewArgs {
    readonly deckPath: string;
    readonly port: number;
    readonly sizes?: readonly SizeSpec[];
    readonly lang?: string;
    readonly lineBreaks?: LineBreaks;
}
export declare const parsePreviewCli: (argv: readonly string[], cwd?: string) => PreviewArgs;
export interface LintArgs {
    readonly deckPath: string;
    readonly fix: boolean;
    readonly json: boolean;
    readonly sizes?: readonly SizeSpec[];
    /** M18-6: migração de uma pasta inteira (`--from 0.x`); `deckPath` é a pasta ou o arquivo. */
    readonly from?: (typeof MIGRATION_SOURCES)[number];
}
export declare const parseLintCli: (argv: readonly string[], cwd?: string) => LintArgs;
/** Primeiro argumento que não é flag; os comandos vêm antes das flags (`pptsx build ...`). */
export declare const commandOf: (argv: readonly string[]) => string | undefined;
export declare const wantsHelp: (argv: readonly string[]) => boolean;
export declare const wantsVersion: (argv: readonly string[]) => boolean;
/** Casca de IO: devolve o código de saída em vez de chamar process.exit. */
export declare const runCli: (argv: readonly string[], cwd?: string, deps?: CliDeps) => Promise<number>;
