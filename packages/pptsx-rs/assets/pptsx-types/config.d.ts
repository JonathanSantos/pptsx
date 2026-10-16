import type { ImportModule, ImportOptions, UserModule } from './cli/loader.ts';
import type { DocumentProperties, FontFace, LineBreaks, SizeSpec, Theme } from './core/types.ts';
import type { DsManifest } from './ds.ts';
import type { LintRule } from './lint/rule.ts';
export declare const CONFIG_FILE_NAME = "pptsx.config.ts";
export declare const LINE_BREAKS: readonly LineBreaks[];
export interface PptsxConfig {
    /** Substitui as fontes padrão (Liberation Sans como Arial), como em RenderOptions.fonts. */
    readonly fonts?: readonly FontFace[];
    readonly sizes?: readonly SizeSpec[];
    readonly lang?: string;
    readonly textSafety?: number;
    /** Como em RenderOptions.lineBreaks; a flag --line-breaks vence. */
    readonly lineBreaks?: LineBreaks;
    /** Como em RenderOptions.embedFonts; a flag --embed-fonts vence. */
    readonly embedFonts?: boolean;
    /** M15: tema de cores e fontes do arquivo, como em RenderOptions.theme. */
    readonly theme?: Theme;
    /** M15: propriedades do documento; sem `title`, a CLI usa o nome do arquivo do deck. */
    readonly document?: DocumentProperties;
    /** M17: regras de lint próprias e códigos desligados (os da engine ou de um DS). */
    readonly lint?: {
        readonly rules?: readonly LintRule[];
        readonly disable?: readonly string[];
    };
    /** M17: design systems registrados (`defineDs`): regras no lint, guia e schema no MCP. */
    readonly ds?: readonly DsManifest[];
}
/** @deprecated Use PptsxConfig (nome antigo, de antes do pacote se chamar pptsx). */
export type TsxSlidesConfig = PptsxConfig;
/** Identidade tipada: só existe para o arquivo de config ganhar inferência. */
export declare const defineConfig: (config: PptsxConfig) => PptsxConfig;
export declare const isLineBreaks: (value: unknown) => value is LineBreaks;
export declare const lineBreaksErrorOf: (source: string, value: unknown) => string;
/** Caminhos de fonte na config são relativos ao arquivo de config, não ao cwd de quem roda a CLI. */
export declare const resolveConfigPaths: (config: PptsxConfig, configDir: string) => PptsxConfig;
export declare const configPathOf: (cwd: string) => string;
export declare const ESM_REQUIRED_MESSAGE: string;
/** Erros do Node quando o deck foi transpilado para CJS e fez require() do pptsx (projeto sem "type": "module"). */
export declare const isRequireAsyncError: (error: unknown) => boolean;
/** Carga do deck/config com o erro de CommonJS traduzido para a correção que o usuário precisa fazer. */
export declare const importUserModule: (file: string, options?: ImportOptions, importModule?: ImportModule) => Promise<UserModule>;
/** Carrega `pptsx.config.ts` de `cwd` (precisa rodar sob o loader do tsx); sem arquivo → {}. `fresh`: ver ImportOptions. */
export declare const loadConfig: (cwd: string, options?: ImportOptions, importModule?: ImportModule) => Promise<PptsxConfig>;
/**
 * M17: a pasta da config de um deck — a do próprio deck ou a mais próxima acima que tem
 * `pptsx.config.ts`; sem nenhuma, o cwd. Assim a config de um DS ou de uma pasta de exemplos vale
 * rodando o build de qualquer lugar (antes, só a do cwd, e a de outra pasta sumia em silêncio).
 */
export declare const configDirOf: (deckPath: string, cwd: string) => string;
