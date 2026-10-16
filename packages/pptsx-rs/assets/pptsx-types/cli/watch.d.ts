/** Observa `paths` e chama `onChange` a cada evento; devolve a função que para de observar. */
export type WatchFn = (paths: readonly string[], onChange: () => void) => () => void;
export declare const WATCH_DEBOUNCE_MS: 150;
export declare const isInside: (path: string, dir: string) => boolean;
export declare const isIgnoredPath: (path: string, ignoredDirs: readonly string[]) => boolean;
/** Diretório do deck (recursivo) e o arquivo de config, sem repetir a config se ela já está dentro do diretório. */
export declare const watchPathsOf: (deckPath: string, configPath: string) => readonly string[];
/** Hora local `HH:MM:SS` para prefixar cada build. */
export declare const timestampOf: (date: Date) => string;
export declare const stampLine: (date: Date, line: string) => string;
/** Erro claro quando a plataforma não tem `fs.watch` recursivo (Linux com Node anterior a 20.13). */
export declare const recursiveWatchErrorOf: (platform: string, version: string) => string;
/** Implementação padrão com `fs.watch` (recursivo: Node 20+ em macOS/Windows, 20.13+ em Linux). */
export declare const createFsWatch: (ignoredDirs: readonly string[]) => WatchFn;
export interface WatchLoopOptions {
    readonly paths: readonly string[];
    readonly watch: WatchFn;
    readonly signal: AbortSignal;
    /** Um build completo; não deve rejeitar (erros são reportados por quem o fornece). */
    readonly rebuild: () => Promise<void>;
    readonly debounceMs?: number;
}
/**
 * Casca do --watch: observa primeiro e só então faz o build inicial, para que uma edição salva durante
 * esse build não se perca. Debounce das mudanças e builds em série (uma mudança durante um build agenda
 * exatamente mais um, ao final). Resolve quando `signal` aborta, depois que o build em curso termina.
 */
export declare const runWatchLoop: ({ paths, watch, signal, rebuild, debounceMs }: WatchLoopOptions) => Promise<void>;
