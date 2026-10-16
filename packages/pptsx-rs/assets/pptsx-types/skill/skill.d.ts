import type { DsManifest } from '../ds.ts';
/**
 * M18-8: a skill do pptsx para agentes — formato Agent Skills (pasta com `SKILL.md`, `references/`,
 * `scripts/`), lida pelo Claude (Claude Code e app) e pelo GitHub Copilot no VS Code. Uma skill, dois
 * destinos: a mesma pasta em `.claude/skills/<nome>/` e `.github/skills/<nome>/`, mais o `.vscode/mcp.json`
 * e o `.mcp.json` que sobem o servidor MCP pelo script. Tudo vem do repo na hora (guia, schema, versão).
 * Se o formato mudar nas ferramentas, só este arquivo muda. Puro: quem grava é a CLI.
 */
export interface SkillFile {
    /** Relativo à pasta de saída, com `/`. */
    readonly path: string;
    readonly content: string;
}
export interface SkillDs {
    readonly manifest: DsManifest;
    /** Como o deck importa o DS (o nome do pacote). */
    readonly importFrom: string;
}
interface RawSchema {
    readonly properties?: Readonly<Record<string, {
        readonly type?: string;
        readonly description?: string;
        readonly examples?: readonly unknown[];
    }>>;
    readonly required?: readonly string[];
}
export interface SkillOptions {
    readonly version: string;
    /** docs/AGENT_GUIDE.md. */
    readonly guide: string;
    /** O schema das primitivas (o do `schema()` do MCP). */
    readonly schema: Readonly<Record<string, RawSchema>>;
    readonly releaseBase?: string;
    readonly bundleSha256?: string;
    readonly ds?: SkillDs;
    /** Nome da skill (minúsculas, números e hífen); padrão `pptsx`. */
    readonly name?: string;
}
export declare const SKILL_DESTINATIONS: readonly ['.claude/skills', '.github/skills'];
/** Nome válido de skill a partir do nome de um pacote (`@pptsx/ds-base` → `pptsx-ds-base`). */
export declare const skillNameOf: (packageName: string) => string;
export declare const skillMarkdown: (options: SkillOptions) => string;
export declare const dsMarkdown: (ds: SkillDs) => string;
export declare const dsConfigOf: (ds: SkillDs) => string;
/**
 * O guia com o aviso de contexto e um índice com a linha de cada seção: ele é longo demais para um Read só
 * (achado do agente virgem do M18-8), e o índice deixa ler só a seção que importa.
 */
export declare const guideReferenceOf: (guide: string) => string;
/**
 * O essencial: as seções de ESSENTIAL_SECTIONS, na ordem do guia. Um `###` entra se a sua `##` pede
 * `'all'` ou se bate com um dos padrões; a introdução da `##` (antes do 1º `###`) entra sempre.
 */
export declare const essentialsOf: (guide: string) => string;
/** Os arquivos da pasta da skill (sem o destino na frente). */
export declare const skillFolderFiles: (options: SkillOptions) => readonly SkillFile[];
/** Tudo o que `pptsx skill --out` grava: a pasta nos dois destinos, os mcp.json e um README. */
export declare const skillFiles: (options: SkillOptions) => readonly SkillFile[];
export {};
