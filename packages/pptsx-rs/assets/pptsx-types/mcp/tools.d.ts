import { type ImportModule } from '../cli/loader.ts';
import type { LineBreaks } from '../core/types.ts';
import type { DsManifest } from '../ds.ts';
/**
 * M16-3: as ferramentas do `pptsx-mcp`. Cada uma devolve o resultado no formato do MCP (texto e imagens);
 * nada vai para o stdout, que é o canal do protocolo. Mensagens de diagnóstico inalteradas: já são para LLM.
 */
export type ToolContent = {
    readonly type: 'text';
    readonly text: string;
} | {
    readonly type: 'image';
    readonly data: string;
    readonly mimeType: 'image/png';
};
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
/** A config vale da pasta do deck para cima; sem nenhuma, a do cwd do servidor (o mesmo da CLI). */
export { configDirOf } from '../config.ts';
export interface BuildInput {
    readonly deck: string;
    readonly sizes?: readonly string[];
    readonly debug?: boolean;
    readonly lineBreaks?: LineBreaks;
    readonly out?: string;
}
/** build: grava .pptx, PNGs e diagnostics.json como a CLI; devolve diagnósticos e o overview de cada tamanho. */
export declare const buildTool: (input: BuildInput, ctx: McpContext) => Promise<ToolResult>;
/** diagnose: só os diagnósticos (sem preview, sem gravar nada): o caminho rápido para iterar. */
export declare const diagnoseTool: (input: Pick<BuildInput, 'deck' | 'sizes'>, ctx: McpContext) => Promise<ToolResult>;
/** preview: o PNG de um slide (número do deck de saída, base 1) num tamanho. */
export declare const previewTool: (input: {
    readonly deck: string;
    readonly size: string;
    readonly slide: number;
}, ctx: McpContext) => Promise<ToolResult>;
export declare const initTool: (input: {
    readonly dir: string;
    readonly force?: boolean;
}, ctx: McpContext) => ToolResult;
/** O núcleo é a fonte "pptsx"; cada DS registrado é uma fonte com o nome dele. */
export declare const CORE_SOURCE = "pptsx";
export declare const guideTool: (input: {
    readonly source?: string;
    readonly section?: string;
    readonly deck?: string;
}, base: McpContext) => Promise<ToolResult>;
export declare const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
interface RawProp {
    readonly type?: string;
    readonly description?: string;
    readonly examples?: readonly unknown[];
}
/** Um tipo TypeScript (texto) → o JSON Schema que dá para dizer: enum de literais, tipos simples, ou só `x-tsType`. */
export declare const propToJsonSchema: (raw: RawProp) => Readonly<Record<string, unknown>>;
/** O schema de uma fonte (núcleo ou DS) como documento JSON Schema 2020-12, com `$id` por fonte e uma `$defs` por primitiva/componente. */
export declare const toJsonSchema: (source: string, raw: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>;
export declare const schemaTool: (input: {
    readonly source?: string;
    readonly primitive?: string;
    readonly deck?: string;
}, base?: McpContext) => Promise<ToolResult>;
export interface LintInput {
    readonly deck: string;
    readonly sizes?: readonly string[];
    /** DS a mais (caminho ou pacote), além dos da config da pasta do deck. */
    readonly ds?: readonly string[];
}
/** lint: as regras da engine e as dos DS (config do deck, `ds`), sem shell. `isError` com achado error ou warning. */
export declare const lintTool: (input: LintInput, ctx: McpContext) => Promise<ToolResult>;
