/**
 * M18-7: o bundle de arquivo único (`tools/standalone/`) não tem a pasta do pacote: antes de carregar o
 * núcleo ele preenche este runtime (versão, guia, pasta das fontes embutidas). No build normal fica vazio
 * e cada ponto lê o arquivo do pacote como sempre.
 */
export interface StandaloneRuntime {
    readonly version: string;
    /** Texto do docs/AGENT_GUIDE.md (o `guide` do MCP). */
    readonly guide: string;
    /** Onde o bundle gravou as fontes Liberation embutidas. */
    readonly fontDir: string;
}
export declare const standaloneRuntime: () => StandaloneRuntime | undefined;
export declare const setStandaloneRuntime: (runtime: StandaloneRuntime) => void;
