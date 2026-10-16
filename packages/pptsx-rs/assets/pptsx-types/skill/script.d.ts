/**
 * M18-8: o `scripts/pptsx.mjs` da skill — JS puro, sem dependências, Node 18+. Acha o runtime nesta ordem:
 * `PPTSX_BUNDLE`, o bundle no cache (`~/.cache/pptsx/<versão>/pptsx.mjs`, o mesmo do bundle), o download
 * da release com o SHA256 conferido e, por último, `npx pptsx@<versão>`. Nunca instala nada global. No
 * `build`, roda com `--json` e imprime o resumo que o modelo lê. O texto não usa crase nem `${` para caber
 * num String.raw sem escapes.
 */
export interface SkillScriptOptions {
    readonly version: string;
    /** `https://github.com/<dono>/<repo>/releases/download/v<versão>`; sem ele, não há download. */
    readonly releaseBase?: string;
    /** SHA256 do pptsx.mjs desta versão; sem ele, o script baixa o SHA256SUMS da release. */
    readonly bundleSha256?: string;
}
export declare const skillScript: (options: SkillScriptOptions) => string;
/** `scripts/pptsx.cmd`: o mesmo script no Windows (o Explorer e o cmd não leem o shebang). */
export declare const SKILL_SCRIPT_CMD = "@echo off\r\nnode \"%~dp0pptsx.mjs\" %*\r\n";
