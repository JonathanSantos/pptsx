import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOnce, exitCodeOf, loadDeck, mergeOptions, parseCli, summaryOf } from '../cli.ts';
import { applyInit, initSummaryOf } from '../cli/init.ts';
import { defaultImportModule, type ImportModule } from '../cli/loader.ts';
import { configDirOf, loadConfig } from '../config.ts';
import type { Diagnostic, LineBreaks } from '../core/types.ts';
import { render } from '../render.ts';
import { guideLookup } from './guide.ts';
import { PROPS_SCHEMA } from './schema.generated.ts';
import type { DsManifest } from '../ds.ts';

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
  /** M17: design systems registrados (config ou `--ds`): o guia e o schema de cada um viram fontes. */
  readonly ds?: readonly DsManifest[];
}

const text = (value: string): ToolContent => ({ type: 'text', text: value });
const png = (data: Buffer): ToolContent => ({ type: 'image', data: data.toString('base64'), mimeType: 'image/png' });

const failure = (error: unknown): ToolResult => ({ content: [text(`Erro: ${error instanceof Error ? error.message : String(error)}`)], isError: true });

/** A config vale da pasta do deck para cima; sem nenhuma, a do cwd do servidor (o mesmo da CLI). */
export { configDirOf } from '../config.ts';

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

/** O núcleo é a fonte "pptsx"; cada DS registrado é uma fonte com o nome dele. */
export const CORE_SOURCE = 'pptsx';

const sourcesLine = (ctx: McpContext, has: (ds: DsManifest) => boolean): string => {
  const others = (ctx.ds ?? []).filter(has).map((ds) => `"${ds.name}"`);
  return others.length === 0 ? '' : `\n\nOutras fontes (passe source): ${others.join(', ')}.`;
};

const unknownSource = (source: string, ctx: McpContext): ToolResult => ({
  content: [text(`Fonte "${source}" não registrada. Fontes: "${CORE_SOURCE}"${(ctx.ds ?? []).map((ds) => `, "${ds.name}"`).join('')}. Um DS entra pelo pptsx.config.ts (ds: [...]) ou por pptsx-mcp --ds <pacote>.`)],
  isError: true,
});

const dsOf = (ctx: McpContext, source: string): DsManifest | undefined => (ctx.ds ?? []).find((ds) => ds.name === source);

export const guideTool = (input: { readonly source?: string; readonly section?: string }, ctx: McpContext): ToolResult => {
  const source = input.source ?? CORE_SOURCE;
  if (source !== CORE_SOURCE) {
    const ds = dsOf(ctx, source);
    if (ds === undefined) return unknownSource(source, ctx);
    if (ds.guide === undefined) return { content: [text(`O DS "${ds.name}" não registrou guia.`)], isError: true };
    const { text: body, found } = guideLookup(ds.guide, input.section, `guia do DS "${ds.name}"`);
    return { content: [text(body)], ...(found ? {} : { isError: true }) };
  }
  const { text: body, found } = guideLookup(ctx.guideText?.() ?? readFileSync(GUIDE, 'utf8'), input.section);
  const extra = input.section === undefined ? sourcesLine(ctx, (ds) => ds.guide !== undefined) : '';
  return { content: [text(body + extra)], ...(found ? {} : { isError: true }) };
};

const lookupSchema = (schema: Readonly<Record<string, unknown>>, name: string | undefined, label: string): ToolResult => {
  if (name === undefined) return { content: [text(JSON.stringify(schema, null, 2))] };
  // "Text", "text" e "TEXT" valem: o agente costuma escrever como a tag JSX.
  const key = Object.keys(schema).find((item) => item.toLowerCase() === name.toLowerCase());
  if (key === undefined) return { content: [text(`"${name}" não existe em ${label}; use ${Object.keys(schema).join(', ')}.`)], isError: true };
  return { content: [text(JSON.stringify(schema[key], null, 2))] };
};

export const schemaTool = (input: { readonly source?: string; readonly primitive?: string }, ctx: McpContext = { cwd: process.cwd() }): ToolResult => {
  const source = input.source ?? CORE_SOURCE;
  if (source !== CORE_SOURCE) {
    const ds = dsOf(ctx, source);
    if (ds === undefined) return unknownSource(source, ctx);
    if (ds.schema === undefined) return { content: [text(`O DS "${ds.name}" não registrou schema.`)], isError: true };
    return lookupSchema(ds.schema, input.primitive, ds.name);
  }
  if (input.primitive === undefined) return { content: [text(JSON.stringify(PROPS_SCHEMA, null, 2) + sourcesLine(ctx, (ds) => ds.schema !== undefined))] };
  return lookupSchema(PROPS_SCHEMA, input.primitive, 'pptsx (primitivas)');
};
