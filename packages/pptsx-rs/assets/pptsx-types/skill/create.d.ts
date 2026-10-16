import { type SkillDs, type SkillFile } from './skill.ts';
/**
 * M18-8: a borda da skill — lê do pacote o guia, a versão, o repositório (para a URL da release) e o
 * SHA256 do bundle, se ele foi gerado (`dist/standalone/SHA256SUMS`). O `pptsx-ds skill` do kit usa isto.
 */
export interface CreateSkillOptions {
    readonly ds?: SkillDs;
    readonly name?: string;
    /** Base das releases (`…/releases/download/v<versão>`); padrão: a do `repository` do package.json. */
    readonly releaseBase?: string;
}
interface PackageInfo {
    readonly version: string;
    readonly repository?: string | {
        readonly url?: string;
    };
}
/** `github:dono/repo`, `https://github.com/dono/repo(.git)` ou `git+https://…` → `dono/repo`. */
export declare const githubRepoOf: (repository: PackageInfo['repository']) => string | undefined;
export declare const createSkillFiles: (options?: CreateSkillOptions) => readonly SkillFile[];
/** Grava os arquivos na pasta (o script com permissão de execução). Devolve os caminhos. */
export declare const writeSkill: (out: string, files: readonly SkillFile[]) => readonly string[];
export {};
