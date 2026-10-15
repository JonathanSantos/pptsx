import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOnce, exitCodeOf, loadDeck, mergeOptions, parseCli, summaryOf } from '../cli.ts';
import { applyInit, initSummaryOf } from '../cli/init.ts';
import { standaloneRuntime } from '../standalone.ts';
import { defaultImportModule, type ImportModule } from '../cli/loader.ts';
import { configDirOf, loadConfig } from '../config.ts';
import type { Diagnostic, LineBreaks, SizeSpec } from '../core/types.ts';
import { render } from '../render.ts';
import { guideLookup } from './guide.ts';
import { PROPS_SCHEMA } from './schema.generated.ts';
import { dsOfDeck, importDs, mergeDs } from './ds.ts';
import { lintDeck, lintSummaryOf } from '../lint/lint.ts';
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
    // Padrão ao lado do deck: dois deck.tsx em pastas diferentes não se sobrescrevem (agente virgem do M18-9).
    const out = input.out === undefined ? resolve(dirname(deckPath), 'dist') : resolve(ctx.cwd, input.out);
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

/** M18: os DS do contexto mais os da config do deck, quando a chamada traz um deck. */
const withDeckDs = async (ctx: McpContext, deck: string | undefined): Promise<McpContext> =>
  deck === undefined ? ctx : { ...ctx, ds: mergeDs(ctx.ds ?? [], await dsOfDeck(resolve(ctx.cwd, deck), ctx.cwd)) };

export const guideTool = async (input: { readonly source?: string; readonly section?: string; readonly deck?: string }, base: McpContext): Promise<ToolResult> => {
  const ctx = await withDeckDs(base, input.deck);
  const source = input.source ?? CORE_SOURCE;
  if (source !== CORE_SOURCE) {
    const ds = dsOf(ctx, source);
    if (ds === undefined) return unknownSource(source, ctx);
    if (ds.guide === undefined) return { content: [text(`O DS "${ds.name}" não registrou guia.`)], isError: true };
    const { text: body, found } = guideLookup(ds.guide, input.section, `guia do DS "${ds.name}"`);
    return { content: [text(body)], ...(found ? {} : { isError: true }) };
  }
  const { text: body, found } = guideLookup(ctx.guideText?.() ?? standaloneRuntime()?.guide ?? readFileSync(GUIDE, 'utf8'), input.section);
  const extra = input.section === undefined ? sourcesLine(ctx, (ds) => ds.guide !== undefined) : '';
  return { content: [text(body + extra)], ...(found ? {} : { isError: true }) };
};

// ───────────── JSON Schema (M18-2) ─────────────

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

const JSON_TYPES: Readonly<Record<string, string>> = { string: 'string', number: 'number', boolean: 'boolean', array: 'array', object: 'object', null: 'null' };

interface RawProp {
  readonly type?: string;
  readonly description?: string;
  readonly examples?: readonly unknown[];
}

/** Um tipo TypeScript (texto) → o JSON Schema que dá para dizer: enum de literais, tipos simples, ou só `x-tsType`. */
export const propToJsonSchema = (raw: RawProp): Readonly<Record<string, unknown>> => {
  const ts = (raw.type ?? '').trim();
  const parts = ts.split('|').map((part) => part.trim()).filter((part) => part !== '');
  const literals = parts.map((part) => /^"([^"]*)"$/.exec(part)?.[1]);
  const shape: Record<string, unknown> =
    parts.length > 0 && literals.every((literal) => literal !== undefined)
      ? { type: 'string', enum: literals }
      : parts.length > 0 && parts.every((part) => JSON_TYPES[part] !== undefined)
        ? { type: parts.length === 1 ? JSON_TYPES[parts[0]!] : parts.map((part) => JSON_TYPES[part]) }
        : {};
  return {
    ...shape,
    ...(raw.description === undefined ? {} : { description: raw.description }),
    ...(raw.examples === undefined || raw.examples.length === 0 ? {} : { examples: raw.examples }),
    ...(ts === '' ? {} : { 'x-tsType': ts }),
  };
};

/** O schema de uma fonte (núcleo ou DS) como documento JSON Schema 2020-12, com `$id` por fonte e uma `$defs` por primitiva/componente. */
export const toJsonSchema = (source: string, raw: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => ({
  $schema: JSON_SCHEMA_DIALECT,
  $id: `pptsx:schema/${source}`,
  title: `Props de ${source}`,
  $defs: Object.fromEntries(
    Object.entries(raw).map(([name, value]) => {
      const def = value as { readonly properties?: Readonly<Record<string, RawProp>>; readonly required?: readonly string[] };
      return [name, {
        type: 'object',
        properties: Object.fromEntries(Object.entries(def.properties ?? {}).map(([prop, schema]) => [prop, propToJsonSchema(schema)])),
        required: def.required ?? [],
      }];
    }),
  ),
});

const lookupSchema = (source: string, raw: Readonly<Record<string, unknown>>, name: string | undefined, label: string, extra = ''): ToolResult => {
  const document = toJsonSchema(source, raw);
  if (name === undefined) return { content: [text(JSON.stringify(document, null, 2) + extra)] };
  const defs = document.$defs as Readonly<Record<string, unknown>>;
  // "Text", "text" e "TEXT" valem: o agente costuma escrever como a tag JSX.
  const key = Object.keys(defs).find((item) => item.toLowerCase() === name.toLowerCase());
  if (key === undefined) return { content: [text(`"${name}" não existe em ${label}; use ${Object.keys(defs).join(', ')}.`)], isError: true };
  return { content: [text(JSON.stringify({ $schema: JSON_SCHEMA_DIALECT, $id: `pptsx:schema/${source}#/$defs/${key}`, ...(defs[key] as object) }, null, 2))] };
};

export const schemaTool = async (input: { readonly source?: string; readonly primitive?: string; readonly deck?: string }, base: McpContext = { cwd: process.cwd() }): Promise<ToolResult> => {
  const ctx = await withDeckDs(base, input.deck);
  const source = input.source ?? CORE_SOURCE;
  if (source !== CORE_SOURCE) {
    const ds = dsOf(ctx, source);
    if (ds === undefined) return unknownSource(source, ctx);
    if (ds.schema === undefined) return { content: [text(`O DS "${ds.name}" não registrou schema.`)], isError: true };
    return lookupSchema(ds.name, ds.schema, input.primitive, ds.name);
  }
  return lookupSchema(CORE_SOURCE, PROPS_SCHEMA, input.primitive, 'pptsx (primitivas)', input.primitive === undefined ? sourcesLine(ctx, (ds) => ds.schema !== undefined) : '');
};

// ───────────── lint (M18-2) ─────────────

export interface LintInput {
  readonly deck: string;
  readonly sizes?: readonly string[];
  /** DS a mais (caminho ou pacote), além dos da config da pasta do deck. */
  readonly ds?: readonly string[];
}

/** lint: as regras da engine e as dos DS (config do deck, `ds`), sem shell. `isError` com achado error ou warning. */
export const lintTool = async (input: LintInput, ctx: McpContext): Promise<ToolResult> => {
  try {
    const deckPath = resolve(ctx.cwd, input.deck);
    const configDir = configDirOf(deckPath, ctx.cwd);
    const importModule = ctx.importModule ?? defaultImportModule;
    const config = await loadConfig(configDir, { fresh: true, cwd: configDir }, importModule);
    const deck = await loadDeck(deckPath, { fresh: true, cwd: configDir }, importModule);
    const extra = await Promise.all((input.ds ?? []).map((specifier) => importDs(specifier, ctx.cwd)));
    const dsList = mergeDs(config.ds ?? [], extra);
    const findings = await lintDeck(deck, {
      sizes: (input.sizes ?? config.sizes ?? ['16x9']) as readonly SizeSpec[],
      baseDir: dirname(deckPath),
      ...(config.theme === undefined ? {} : { theme: config.theme }),
      render: { fonts: config.fonts, lang: config.lang, textSafety: config.textSafety, lineBreaks: config.lineBreaks },
      rules: [...(config.lint?.rules ?? []), ...dsList.flatMap((ds) => ds.rules)],
      disable: config.lint?.disable ?? [],
    });
    const ds = dsList.map((item) => item.name);
    return {
      content: [text(`${lintSummaryOf(findings)}${ds.length === 0 ? '' : `\n\nDS: ${ds.join(', ')}`}\n\n${JSON.stringify({ findings }, null, 2)}`)],
      isError: findings.some((finding) => finding.severity !== 'info'),
    };
  } catch (error) {
    return failure(error);
  }
};
