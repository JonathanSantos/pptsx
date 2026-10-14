import { DEFAULTS } from '../core/defaults.ts';
import { existsSync, statSync, watch as fsWatch, type FSWatcher } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Observa `paths` e chama `onChange` a cada evento; devolve a função que para de observar. */
export type WatchFn = (paths: readonly string[], onChange: () => void) => () => void;

// Editores costumam gravar em rajadas (temp + rename + chmod); 150 ms junta a rajada num build só.
export const WATCH_DEBOUNCE_MS = DEFAULTS.watchDebounceMs;

/** Pastas cujas mudanças nunca disparam build: a saída (senão o build se realimenta) e ruído comum. */
const IGNORED_SEGMENTS: readonly string[] = ['node_modules', '.git'];

export const isInside = (path: string, dir: string): boolean => {
  const rel = relative(resolve(dir), resolve(path));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

export const isIgnoredPath = (path: string, ignoredDirs: readonly string[]): boolean =>
  ignoredDirs.some((dir) => isInside(path, dir)) || path.split(sep).some((segment) => IGNORED_SEGMENTS.includes(segment));

/** Diretório do deck (recursivo) e o arquivo de config, sem repetir a config se ela já está dentro do diretório. */
export const watchPathsOf = (deckPath: string, configPath: string): readonly string[] => {
  const deckDir = dirname(resolve(deckPath));
  return isInside(configPath, deckDir) ? [deckDir] : [deckDir, resolve(configPath)];
};

/** Hora local `HH:MM:SS` para prefixar cada build. */
export const timestampOf = (date: Date): string =>
  [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');

export const stampLine = (date: Date, line: string): string => `[${timestampOf(date)}] ${line}`;

// Arquivo é observado pelo diretório pai: salvar com rename troca o inode e mataria um watch direto,
// e a config pode nem existir ainda quando o watch começa.
const watchFile = (file: string, onChange: () => void): FSWatcher | undefined => {
  const dir = dirname(file);
  if (!existsSync(dir)) return undefined;
  return fsWatch(dir, (_event, filename) => {
    if (filename === null || filename.toString() === basename(file)) onChange();
  });
};

const watchDir = (dir: string, ignoredDirs: readonly string[], onChange: () => void): FSWatcher =>
  fsWatch(dir, { recursive: true }, (_event, filename) => {
    if (filename !== null && isIgnoredPath(join(dir, filename.toString()), ignoredDirs)) return;
    onChange();
  });

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/** Implementação padrão com `fs.watch` (recursivo: Node 20+ em macOS/Windows, 20.13+ em Linux). */
export const createFsWatch =
  (ignoredDirs: readonly string[]): WatchFn =>
  (paths, onChange) => {
    const watchers = paths.flatMap((path) => {
      const watcher = isDirectory(path) ? watchDir(path, ignoredDirs, onChange) : watchFile(path, onChange);
      // Um diretório apagado no meio do watch emite 'error'; não deve derrubar o processo.
      watcher?.on('error', () => undefined);
      return watcher ? [watcher] : [];
    });
    return () => watchers.forEach((watcher) => watcher.close());
  };

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
export const runWatchLoop = ({ paths, watch, signal, rebuild, debounceMs = WATCH_DEBOUNCE_MS }: WatchLoopOptions): Promise<void> =>
  new Promise((resolveLoop) => {
    let timer: NodeJS.Timeout | undefined;
    let running: Promise<void> | undefined;
    let pending = false;

    const start = (): void => {
      if (signal.aborted) return;
      if (running) {
        pending = true;
        return;
      }
      running = rebuild()
        .catch(() => undefined)
        .finally(() => {
          running = undefined;
          if (!pending) return;
          pending = false;
          start();
        });
    };

    const onChange = (): void => {
      if (signal.aborted) return;
      clearTimeout(timer);
      timer = setTimeout(start, debounceMs);
    };

    const stopWatching = watch(paths, onChange);

    const finish = (): void => {
      clearTimeout(timer);
      stopWatching();
      void (running ?? Promise.resolve()).then(() => resolveLoop());
    };

    if (signal.aborted) return finish();
    signal.addEventListener('abort', finish, { once: true });
    start();
  });
