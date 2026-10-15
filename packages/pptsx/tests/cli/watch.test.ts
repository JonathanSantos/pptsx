import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { runCli } from '../../src/cli.ts';
import type { ImportModule, UserModule } from '../../src/cli/loader.ts';
import { recursiveWatchErrorOf } from '../../src/cli/watch.ts';
import { captureConsole, sleep, waitFor, type CapturedConsole } from '../helpers/console.ts';

/**
 * `build --watch` (M7-B) com a observação injetada: o teste guarda o `onChange` e dispara
 * eventos à mão; `signal` encerra o watch. Timers reais (debounce de 150 ms).
 *
 * No --watch a CLI carrega o deck por um namespace isolado do tsx; dentro do vitest esse import
 * passa pelo module runner e não resolve `pptsx` nem o JSX. Por isso a semântica do watch injeta
 * `importModule` (import do vitest com `?v=`), e o carregador real é coberto num processo de
 * verdade no fim do arquivo (deck dentro de tests/, coberto pelo tsconfig do repo).
 */

const TIMEOUT = 60_000;
const BUILD_WAIT = 20_000;
/** Bem acima do debounce (150 ms): se fosse haver um segundo build, ele já teria saído. */
const SETTLE_MS = 600;

const deckSource = (title: string): string => `import { Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={36}>
      <Text fontSize={28}>${title}</Text>
    </Slide>
  </Deck>
));
`;
const BROKEN_DECK = `import { Deck, Slide, Text, defineDeck } from 'pptsx';
export default defineDeck(() => (
  <Deck>
    <Slide>
      <Text>sem fechar
`;

const DECK_TSCONFIG = {
  compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
} as const;

const tmpDirs: string[] = [];
afterAll(() => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const projectWithDeck = (): { readonly dir: string; readonly deck: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'pptsx-watch-'));
  tmpDirs.push(dir);
  const deck = join(dir, 'deck.tsx');
  // Como o `pptsx init` cria: o deck precisa carregar como ESM.
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'watch-deck', private: true, type: 'module' }));
  // A CLI exige um tsconfig com jsx/jsxImportSource=pptsx perto do deck (CONTRACTS §cli "M7 tsconfig do deck").
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(DECK_TSCONFIG, null, 2));
  writeFileSync(deck, deckSource('Versão 1'));
  return { dir, deck };
};

/** `watch` falso: registra os caminhos e o onChange; `dispose` é um spy. */
const fakeWatch = () => {
  const calls: { readonly paths: readonly string[]; readonly onChange: () => void }[] = [];
  const dispose = vi.fn();
  const watch = (paths: readonly string[], onChange: () => void): (() => void) => {
    calls.push({ paths, onChange });
    return dispose;
  };
  const fire = (): void => {
    const call = calls.at(-1);
    if (!call) throw new Error('watch was not called');
    call.onChange();
  };
  return { watch, calls, dispose, fire };
};

let output: CapturedConsole;
beforeEach(() => {
  output = captureConsole();
});
afterEach(() => output.restore());

/** NDJSON: cada console.log do --watch --json é uma linha com um objeto. */
const jsonLines = (): Record<string, unknown>[] =>
  output.logs
    .flatMap((entry) => entry.split('\n'))
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

/**
 * import() do vitest (resolve `pptsx` pelo alias). `?v=` fura o cache do arquivo; o valor não pode
 * ter `.` (o vite deixaria de reconhecer a extensão .tsx), por isso hrtime e não Math.random().
 */
const vitestImport: ImportModule = (file) =>
  import(/* @vite-ignore */ `${pathToFileURL(file).href}?v=${process.hrtime.bigint()}`) as Promise<UserModule>;

/** Importador espionado: registra { file, fresh } de cada carga. */
const spyImport = () => {
  const calls: { readonly file: string; readonly fresh: boolean; readonly cwd: string }[] = [];
  const importModule: ImportModule = (file, options) => {
    calls.push({ file, fresh: options.fresh, cwd: options.cwd });
    return vitestImport(file, options);
  };
  return { importModule, calls };
};

interface WatchStart {
  readonly extra?: readonly string[];
  readonly importModule?: ImportModule;
  readonly fake?: ReturnType<typeof fakeWatch>;
}

const startWatch = (
  dir: string,
  deck: string,
  { extra = ['--json'], importModule = vitestImport, fake = fakeWatch() }: WatchStart = {},
) => {
  const controller = new AbortController();
  const done = runCli(['build', deck, '--preview', 'none', '--out', join(dir, 'dist'), '--watch', ...extra], dir, {
    watch: fake.watch,
    signal: controller.signal,
    importModule,
  });
  return { ...fake, controller, done };
};

/** Watch registrado e build inicial impresso (--json): a partir daqui cada linha nova é um rebuild. */
const ready = async (session: { readonly calls: readonly unknown[] }): Promise<void> => {
  await waitFor(() => session.calls.length > 0, BUILD_WAIT, 'watch registered');
  await waitFor(() => jsonLines().length >= 1, BUILD_WAIT, 'initial build');
};

const slide1Of = async (pptx: string): Promise<string> =>
  (await JSZip.loadAsync(readFileSync(pptx))).file('ppt/slides/slide1.xml')!.async('string');

describe('build --watch', () => {
  it(
    'observes the deck directory',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck);
      await ready(session);
      expect(session.calls).toHaveLength(1);
      expect(session.calls[0]!.paths).toContain(dir);
      session.controller.abort();
      expect(await session.done).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'two changes 50 ms apart → a single rebuild (debounce)',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck);
      await ready(session);
      const baseline = jsonLines().length;

      session.fire();
      await sleep(50);
      session.fire();
      await waitFor(() => jsonLines().length > baseline, BUILD_WAIT, 'rebuild after the burst');
      await sleep(SETTLE_MS);
      expect(jsonLines()).toHaveLength(baseline + 1);
      expect(Object.keys(jsonLines().at(-1)!).sort(), JSON.stringify(jsonLines().at(-1))).toEqual(['diagnostics', 'files']);

      session.controller.abort();
      expect(await session.done).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'a syntax error prints an {error} line and the watch goes on; the fixed deck builds again',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck);
      await ready(session);
      const baseline = jsonLines().length;

      writeFileSync(deck, BROKEN_DECK);
      session.fire();
      await waitFor(() => jsonLines().length > baseline, BUILD_WAIT, 'build of the broken deck');
      const failed = jsonLines()[baseline]!;
      expect(Object.keys(failed)).toEqual(['error']);
      expect(typeof failed.error).toBe('string');

      writeFileSync(deck, deckSource('Versão 2 consertada'));
      session.fire();
      await waitFor(() => jsonLines().length > baseline + 1, BUILD_WAIT, 'build of the fixed deck');
      const fixed = jsonLines()[baseline + 1]!;
      expect(Object.keys(fixed).sort(), JSON.stringify(fixed)).toEqual(['diagnostics', 'files']);
      expect((fixed.files as string[]).some((file) => file.endsWith('deck.16x9.pptx'))).toBe(true);

      // Cada linha é um JSON completo (NDJSON): nada além disso no stdout.
      expect(output.logs.every((entry) => entry.split('\n').length === 1)).toBe(true);

      session.controller.abort();
      expect(await session.done).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'the rebuilt deck is the edited one (ESM cache busted)',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck);
      await ready(session);
      const baseline = jsonLines().length;

      writeFileSync(deck, deckSource('Título editado no watch'));
      session.fire();
      await waitFor(() => jsonLines().length > baseline, BUILD_WAIT, 'rebuild');
      expect(await slide1Of(join(dir, 'dist', 'deck.16x9.pptx'))).toContain('Título editado no watch');

      session.controller.abort();
      expect(await session.done).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'aborting the signal resolves runCli with 0 and calls dispose',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck);
      await ready(session);
      expect(session.dispose).not.toHaveBeenCalled();
      session.controller.abort();
      expect(await session.done).toBe(0);
      expect(session.dispose).toHaveBeenCalledTimes(1);
    },
    TIMEOUT,
  );

  it(
    'every watch build loads the deck with fresh: true',
    async () => {
      const { dir, deck } = projectWithDeck();
      const spy = spyImport();
      const session = startWatch(dir, deck, { importModule: spy.importModule });
      await ready(session);
      const baseline = jsonLines().length;
      session.fire();
      await waitFor(() => jsonLines().length > baseline, BUILD_WAIT, 'rebuild');
      session.controller.abort();
      expect(await session.done).toBe(0);
      const deckLoads = spy.calls.filter((call) => call.file === deck);
      expect(deckLoads.length).toBeGreaterThanOrEqual(2);
      expect(deckLoads.every((call) => call.fresh)).toBe(true);
      // O cwd de runCli (e não process.cwd()) decide o tsconfig do namespace do tsx.
      expect(dir).not.toBe(process.cwd());
      expect(deckLoads.every((call) => call.cwd === dir)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'a normal build (no --watch) loads the deck with fresh: false',
    async () => {
      const { dir, deck } = projectWithDeck();
      const spy = spyImport();
      const code = await runCli(['build', deck, '--preview', 'none', '--out', join(dir, 'dist'), '--json'], dir, {
        importModule: spy.importModule,
      });
      expect(code).toBe(0);
      expect(spy.calls.filter((call) => call.file === deck)).toEqual([{ file: deck, fresh: false, cwd: dir }]);
    },
    TIMEOUT,
  );

  it(
    'starts observing before the initial build; a change during it triggers one rebuild afterwards',
    async () => {
      const { dir, deck } = projectWithDeck();
      const fake = fakeWatch();
      const watchedAtFirstLoad: number[] = [];
      let deckLoads = 0;
      const importModule: ImportModule = (file, options) => {
        if (file === deck) {
          deckLoads += 1;
          // Primeira carga = build inicial: o watch já precisa estar registrado; a mudança entra na fila.
          if (deckLoads === 1) {
            watchedAtFirstLoad.push(fake.calls.length);
            fake.fire();
          }
        }
        return vitestImport(file, options);
      };
      const session = startWatch(dir, deck, { importModule, fake });
      await waitFor(() => jsonLines().length >= 2, BUILD_WAIT, 'initial build + queued rebuild');
      await sleep(SETTLE_MS);
      expect(watchedAtFirstLoad).toEqual([1]);
      expect(jsonLines()).toHaveLength(2);
      expect(deckLoads).toBe(2);
      for (const line of jsonLines()) expect(Object.keys(line).sort(), JSON.stringify(line)).toEqual(['diagnostics', 'files']);
      session.controller.abort();
      expect(await session.done).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'changes after abort do not rebuild',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck);
      await ready(session);
      session.controller.abort();
      await session.done;
      const count = jsonLines().length;
      session.fire();
      await sleep(SETTLE_MS);
      expect(jsonLines()).toHaveLength(count);
    },
    TIMEOUT,
  );

  it(
    'without --json: human summary per build, with a timestamp',
    async () => {
      const { dir, deck } = projectWithDeck();
      const session = startWatch(dir, deck, { extra: [] });
      await waitFor(() => session.calls.length > 0, BUILD_WAIT, 'watch registered');
      await waitFor(() => output.logs.some((l) => l.includes('deck.16x9.pptx')), BUILD_WAIT, 'initial build');
      await sleep(100);
      const baseline = output.logs.length;
      session.fire();
      await waitFor(() => output.logs.slice(baseline).some((l) => /\d{2}:\d{2}:\d{2}/.test(l)), BUILD_WAIT, 'stamped summary');
      expect(output.logs.slice(baseline).join('\n')).toContain('deck.16x9.pptx');
      session.controller.abort();
      expect(await session.done).toBe(0);
    },
    TIMEOUT,
  );
});

// Deck em tests/watch-tmp (no `include` do tsconfig do repo, com `paths` para pptsx; pasta sem '.'
// porque o `include` do TS ignora diretórios ocultos) para o tsx real compilar.
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BIN = join(REPO_ROOT, 'bin', 'pptsx.mjs');

describe('build --watch — real process (bin, fs.watch and tsx namespace)', () => {
  it(
    'an edited component imported by the deck is reloaded; SIGINT exits with 0',
    async () => {
      const scratch = join(REPO_ROOT, 'tests', 'watch-tmp');
      mkdirSync(scratch, { recursive: true });
      const dir = mkdtempSync(join(scratch, 'deck-'));
      tmpDirs.push(scratch);
      const out = mkdtempSync(join(tmpdir(), 'pptsx-watch-out-'));
      tmpDirs.push(out);
      const component = (title: string): string =>
        `import { Text } from 'pptsx';\nexport const Title = () => <Text fontSize={28}>${title}</Text>;\n`;
      writeFileSync(join(dir, 'title.tsx'), component('Componente v1'));
      const deck = join(dir, 'deck.tsx');
      writeFileSync(
        deck,
        `import { Deck, Slide, defineDeck } from 'pptsx';\nimport { Title } from './title.tsx';\n` +
          `export default defineDeck(() => (<Deck><Slide padding={36}><Title /></Slide></Deck>));\n`,
      );

      const child = spawn(process.execPath, [BIN, 'build', deck, '--watch', '--json', '--preview', 'none', '--out', out], {
        cwd: REPO_ROOT,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
      const lines = (): Record<string, unknown>[] =>
        stdout
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => JSON.parse(line) as Record<string, unknown>);

      try {
        await waitFor(() => lines().length >= 1, BUILD_WAIT, `first build\n${stderr}`);
        expect(Object.keys(lines()[0]!).sort(), JSON.stringify(lines()[0])).toEqual(['diagnostics', 'files']);
        const pptx = join(out, 'deck.16x9.pptx');
        expect(await slide1Of(pptx)).toContain('Componente v1');

        // Sob carga o primeiro evento pode se perder: regrava a cada 2 s até sair o rebuild.
        const deadline = Date.now() + BUILD_WAIT;
        while (lines().length < 2 && Date.now() < deadline) {
          writeFileSync(join(dir, 'title.tsx'), component('Componente v2'));
          await waitFor(() => lines().length >= 2, 2_000, 'rebuild').catch(() => undefined);
        }
        expect(lines().length, `rebuild after editing the component\n${stderr}`).toBeGreaterThanOrEqual(2);
        const rebuilt = lines().at(-1)!;
        expect(Object.keys(rebuilt).sort(), JSON.stringify(rebuilt)).toEqual(['diagnostics', 'files']);
        expect(await slide1Of(pptx)).toContain('Componente v2');
      } finally {
        child.kill('SIGINT');
      }
      expect(await exited).toBe(0);
    },
    TIMEOUT,
  );
});

describe('watch — plataforma sem fs.watch recursivo (M18-5)', () => {
  it('a mensagem diz a plataforma, a versão do Node e o que fazer', () => {
    const message = recursiveWatchErrorOf('linux', 'v20.10.0');
    expect(message).toContain('linux');
    expect(message).toContain('v20.10.0');
    expect(message).toContain('Node 20.13');
  });
});
