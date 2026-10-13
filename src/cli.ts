import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { DeckDefinition, RenderResult } from './core/types.ts';
import { render } from './render.ts';
import { parseSizeList } from './sizes.ts';

const USAGE = 'uso: tsx-slides build <deck.tsx> [--size 16x9,4x3] [--out dist/] [--debug]';

interface BuildArgs {
  readonly deckPath: string;
  readonly sizes: string;
  readonly outDir: string;
  readonly debug: boolean;
}

const parseCli = (argv: readonly string[]): BuildArgs => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      size: { type: 'string', default: '16x9' },
      out: { type: 'string', default: 'dist' },
      debug: { type: 'boolean', default: false },
    },
  });
  const [command, deckPath] = positionals;
  if (command !== 'build' || !deckPath) throw new Error(USAGE);
  return { deckPath: resolve(deckPath), sizes: values.size, outDir: resolve(values.out), debug: values.debug };
};

const loadDeck = async (deckPath: string): Promise<DeckDefinition> => {
  const module = await import(pathToFileURL(deckPath).href);
  if (typeof module.default !== 'function') throw new Error(`${deckPath} precisa exportar default defineDeck(...)`);
  return module.default;
};

const writeResult = (outDir: string, deckName: string, result: RenderResult): string => {
  const file = join(outDir, `${deckName}.${result.size}.pptx`);
  writeFileSync(file, result.buffer);
  return file;
};

const main = async (): Promise<void> => {
  const args = parseCli(process.argv.slice(2));
  const deck = await loadDeck(args.deckPath);
  const results = await render(deck, {
    sizes: parseSizeList(args.sizes),
    debug: args.debug,
    baseDir: dirname(args.deckPath),
  });
  mkdirSync(args.outDir, { recursive: true });
  const deckName = basename(args.deckPath, extname(args.deckPath));
  results.map((result) => writeResult(args.outDir, deckName, result)).forEach((file) => console.log(file));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
