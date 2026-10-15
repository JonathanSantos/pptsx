import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildOnce, exitCodeOf, loadDeck, mergeOptions, parseCli, summaryOf } from '../cli.ts';
import { applyInit, initSummaryOf } from '../cli/init.ts';
import { defaultImportModule, type ImportModule } from '../cli/loader.ts';
import { CONFIG_FILE_NAME, loadConfig } from '../config.ts';
import type { Diagnostic, LineBreaks } from '../core/types.ts';
import { render } from '../render.ts';
import { guideLookup } from './guide.ts';
import { PROPS_SCHEMA } from './schema.generated.ts';

/**
 * M16-3: as ferramentas do `pptsx-mcp`. Cada uma devolve o resultado no formato do MCP (texto e imagens);
 * nada vai para o stdout, que é o canal do protocolo. Mensagens de diagnóstico inalteradas: já são para LLM.
 */

export type ToolContent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly data: string; readonly mimeType: 'image/png' };

export interface ToolResult {
  readonly content: readonly ToolContent[];
  readonly isError?: boolean;
}

export interface McpContext {
  /** Base dos caminhos relativos (`deck`, `out`, `dir`) — o cwd de quem iniciou o servidor. */
  readonly cwd: string;
  readonly importModule?: ImportModule;
  /** Texto do docs/AGENT_GUIDE.md (injetável nos testes). */
  readonly guideText?: () => string;
}

const text = (value: string): ToolContent => ({ type: 'text', text: value });
const png = (data: Buffer): ToolContent => ({ type: 'image', data: data.toString('base64'), mimeType: 'image/png' });

const failure = (error: unknown): ToolResult => ({ content: [text(`Erro: ${error instanceof Error ? error.message : String(error)}`)], isError: true });

/** A config (pptsx.config.ts) vale da pasta do deck para cima; sem nenhuma, a do cwd do servidor. */
export const configDirOf = (deckPath: string, cwd: string): string => {
  const search = (dir: string): string | undefined => {
    if (existsSync(join(dir, CONFIG_FILE_NAME))) return dir;
    const parent = dirname(dir);
    return parent === dir ? undefined : search(parent);
  };
  return search(dirname(deckPath)) ?? cwd;
};

export interface BuildInput {
  readonly deck: string;
  readonly sizes?: readonly string[];
  readonly debug?: boolean;
  readonly lineBreaks?: LineBreaks;
  readonly out?: string;
}

const argvOf = (deckPath: string, input: Omit<BuildInput, 'deck'>, out: string, preview: boolean): readonly string[] => [
  'build',
  deckPath,
  '--out',
  out,
  ...(input.sizes !== undefined && input.sizes.length > 0 ? ['--size', input.sizes.join(',')] : []),
  ...(input.debug === true ? ['--debug'] : []),
  ...(input.lineBreaks === undefined ? [] : ['--line-breaks', input.lineBreaks]),
  ...(preview ? [] : ['--preview', 'none']),
];

const reportOf = (diagnostics: readonly Diagnostic[], extra: Readonly<Record<string, unknown>>): string =>
  `${summaryOf(diagnostics)}\n\n${JSON.stringify({ ...extra, diagnostics }, null, 2)}`;

/** build: grava .pptx, PNGs e diagnostics.json como a CLI; devolve diagnósticos e o overview de cada tamanho. */
export const buildTool = async (input: BuildInput, ctx: McpContext): Promise<ToolResult> => {
  try {
    const deckPath = resolve(ctx.cwd, input.deck);
    const out = resolve(ctx.cwd, input.out ?? 'dist');
    const args = parseCli(argvOf(deckPath, input, out, true), ctx.cwd);
    const outcome = await buildOnce(args, configDirOf(deckPath, ctx.cwd), { importModule: ctx.importModule ?? defaultImportModule }, true);
    const overviews = outcome.files.filter((file) => file.endsWith('.overview.png'));
    return {
      content: [
        text(reportOf(outcome.diagnostics, { files: outcome.files, ...(outcome.fontsMissing ? { fontsMissing: outcome.fontsMissing } : {}) })),
        ...overviews.flatMap((file) => [text(`Overview: ${file}`), png(readFileSync(file))]),
      ],
      isError: exitCodeOf(outcome.diagnostics) === 1,
    };
  } catch (error) {
    return failure(error);
  }
};

const renderDeck = async (input: BuildInput, ctx: McpContext, preview: boolean) => {
  const deckPath = resolve(ctx.cwd, input.deck);
  const configDir = configDirOf(deckPath, ctx.cwd);
  const importModule = ctx.importModule ?? defaultImportModule;
  const config = await loadConfig(configDir, { fresh: true, cwd: configDir }, importModule);
  const deck = await loadDeck(deckPath, { fresh: true, cwd: configDir }, importModule);
  const args = parseCli(argvOf(deckPath, input, resolve(ctx.cwd, 'dist'), preview), ctx.cwd);
  return render(deck, { ...mergeOptions(args, config), includePositioned: true });
};

/** diagnose: só os diagnósticos (sem preview, sem gravar nada): o caminho rápido para iterar. */
export const diagnoseTool = async (input: Pick<BuildInput, 'deck' | 'sizes'>, ctx: McpContext): Promise<ToolResult> => {
  try {
    const results = await renderDeck(input, ctx, false);
    const diagnostics = results.flatMap((result) => result.diagnostics);
    return { content: [text(reportOf(diagnostics, { sizes: results.map((result) => `${result.size}: ${result.positioned?.slides.length ?? '?'} slides`) }))], isError: exitCodeOf(diagnostics) === 1 };
  } catch (error) {
    return failure(error);
  }
};

/** preview: o PNG de um slide (número do deck de saída, base 1) num tamanho. */
export const previewTool = async (input: { readonly deck: string; readonly size: string; readonly slide: number }, ctx: McpContext): Promise<ToolResult> => {
  try {
    const [result] = await renderDeck({ deck: input.deck, sizes: [input.size] }, ctx, true);
    const slides = result?.preview?.slides ?? [];
    const image = slides[input.slide - 1];
    if (image === undefined) return { content: [text(`O deck tem ${slides.length} slides em ${input.size}; peça de 1 a ${slides.length}.`)], isError: true };
    const own = (result?.diagnostics ?? []).filter((diagnostic) => diagnostic.slide === input.slide);
    return { content: [text(`Slide ${input.slide} de ${slides.length} (${input.size}). ${summaryOf(own)}`), png(image)] };
  } catch (error) {
    return failure(error);
  }
};

export const initTool = (input: { readonly dir: string; readonly force?: boolean }, ctx: McpContext): ToolResult => {
  try {
    const dir = resolve(ctx.cwd, input.dir);
    return { content: [text(initSummaryOf(dir, applyInit({ dir, force: input.force ?? false }), ctx.cwd))] };
  } catch (error) {
    return failure(error);
  }
};

const GUIDE = new URL('../../docs/AGENT_GUIDE.md', import.meta.url);

export const guideTool = (input: { readonly section?: string }, ctx: McpContext): ToolResult => {
  const { text: body, found } = guideLookup(ctx.guideText?.() ?? readFileSync(GUIDE, 'utf8'), input.section);
  return { content: [text(body)], ...(found ? {} : { isError: true }) };
};

export const schemaTool = (input: { readonly primitive?: string }): ToolResult => {
  if (input.primitive === undefined) return { content: [text(JSON.stringify(PROPS_SCHEMA, null, 2))] };
  // "Text", "text" e "TEXT" valem: o agente costuma escrever como a tag JSX.
  const key = Object.keys(PROPS_SCHEMA).find((name) => name.toLowerCase() === input.primitive!.toLowerCase());
  const schema = key === undefined ? undefined : (PROPS_SCHEMA as Readonly<Record<string, unknown>>)[key];
  if (schema === undefined) return { content: [text(`Primitiva "${input.primitive}" não existe; use ${Object.keys(PROPS_SCHEMA).join(', ')}.`)], isError: true };
  return { content: [text(JSON.stringify(schema, null, 2))] };
};
