import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { DeckDefinition, RenderResult } from './core/types.ts';
import { render } from './render.ts';
import { parseSizeList } from './sizes.ts';

const USAGE =
  'uso: tsx-slides build <deck.tsx> [--size 16x9,4x3] [--out dist/] [--debug] [--preview native|none] [--preview-width 1280]';

interface BuildArgs {
  readonly deckPath: string;
  readonly sizes: string;
  readonly outDir: string;
  readonly debug: boolean;
  readonly preview: boolean;
  readonly previewWidth: number;
}

const parsePreviewMode = (mode: string): boolean => {
  if (mode === 'native') return true;
  if (mode === 'none') return false;
  throw new Error(`--preview inválido: "${mode}" (use native ou none)`);
};

const parseCli = (argv: readonly string[]): BuildArgs => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      size: { type: 'string', default: '16x9' },
      out: { type: 'string', default: 'dist' },
      debug: { type: 'boolean', default: false },
      preview: { type: 'string', default: 'native' },
      'preview-width': { type: 'string', default: '1280' },
    },
  });
  const [command, deckPath] = positionals;
  if (command !== 'build' || !deckPath) throw new Error(USAGE);
  return {
    deckPath: resolve(deckPath),
    sizes: values.size,
    outDir: resolve(values.out),
    debug: values.debug,
    preview: parsePreviewMode(values.preview),
    previewWidth: Number(values['preview-width']),
  };
};

const loadDeck = async (deckPath: string): Promise<DeckDefinition> => {
  const module = await import(pathToFileURL(deckPath).href);
  if (typeof module.default !== 'function') throw new Error(`${deckPath} precisa exportar default defineDeck(...)`);
  return module.default;
};

const slideFileName = (index: number): string => `slide-${String(index + 1).padStart(2, '0')}.png`;

/** Estrutura de saída da spec: <deck>.<size>.pptx, <deck>.<size>.overview.png, <deck>.<size>/slide-NN.png */
const writeResult = (outDir: string, deckName: string, result: RenderResult): readonly string[] => {
  const prefix = join(outDir, `${deckName}.${result.size}`);
  writeFileSync(`${prefix}.pptx`, result.buffer);
  if (!result.preview) return [`${prefix}.pptx`];
  mkdirSync(prefix, { recursive: true });
  result.preview.slides.forEach((png, index) => writeFileSync(join(prefix, slideFileName(index)), png));
  writeFileSync(`${prefix}.overview.png`, result.preview.overview);
  return [`${prefix}.pptx`, `${prefix}.overview.png`, `${prefix}/ (${result.preview.slides.length} PNGs)`];
};

const writeDiagnostics = (outDir: string, deckName: string, results: readonly RenderResult[]): string => {
  const file = join(outDir, `${deckName}.diagnostics.json`);
  writeFileSync(file, `${JSON.stringify(results.flatMap((result) => result.diagnostics), null, 2)}\n`);
  return file;
};

const main = async (): Promise<void> => {
  const args = parseCli(process.argv.slice(2));
  const deck = await loadDeck(args.deckPath);
  const results = await render(deck, {
    sizes: parseSizeList(args.sizes),
    debug: args.debug,
    baseDir: dirname(args.deckPath),
    preview: args.preview ? { mode: 'native', width: args.previewWidth } : false,
  });
  mkdirSync(args.outDir, { recursive: true });
  const deckName = basename(args.deckPath, extname(args.deckPath));
  const written = [...results.flatMap((result) => writeResult(args.outDir, deckName, result)), writeDiagnostics(args.outDir, deckName, results)];
  written.forEach((file) => console.log(file));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
