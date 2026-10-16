/**
 * 1.0.5: os `.d.ts` do pptsx copiados para `.pptsx/types/pptsx/` na pasta do deck, como um pacote de tipos num
 * `typeRoots` do `tsconfig.json`. O editor entende `import … from 'pptsx'` e o JSX sem depender do `node_modules`
 * (o mesmo que o `pptsx-rs init` faz, lá sem npm nenhum).
 *
 * Por que `typeRoots` e não `paths`: o tsx (que roda o deck) segue o `paths` e carregaria o `.d.ts` no lugar do
 * pacote, quebrando o build; `typeRoots` só o TypeScript lê, e com `node_modules/pptsx` presente o pacote
 * instalado vence (tipos nunca ficam velhos por causa da cópia). O `typeRoots` resolve só o nome do pacote, então
 * `pptsx/jsx-runtime` e `pptsx/jsx-dev-runtime` saem como declarações ambientes (`jsx-shim.d.ts`, gerado dos
 * próprios `.d.ts`) referenciadas pela entrada do pacote. IO de borda: só o `init`/`types` chamam.
 */
export declare const TYPES_ROOT = ".pptsx/types";
export declare const TYPES_DIR = ".pptsx/types/pptsx";
/** `compilerOptions.typeRoots` do scaffold: a cópia local e o padrão do TypeScript (que some quando a opção é definida). */
export declare const TYPE_ROOTS: readonly string[];
/** Os dois módulos do JSX como `declare module`, importando do próprio `pptsx` o que importavam por caminho relativo. */
export declare const jsxShimOf: (jsxRuntime: string, jsxDevRuntime: string) => string;
/** `dist/` do pacote (instalado ou, no repo, depois de `npm run build`); ausente quando não há `.d.ts` para copiar. */
export declare const typesSourceDir: () => string | undefined;
/** Caminhos relativos (com `/`) de todo `.d.ts` abaixo de `root`, em ordem alfabética. */
export declare const declarationFilesOf: (root: string, dir?: string) => readonly string[];
export declare const typesReadmeOf: (version: string) => string;
export interface TypesWritten {
    /** Relativo à pasta do projeto (TYPES_DIR). */
    readonly dir: string;
    readonly count: number;
    readonly version: string;
}
export declare const TYPES_MISSING_WARNING = "tipos do pptsx n\u00E3o gravados: o pacote n\u00E3o tem dist/ com os .d.ts (no repo, rode `npm run build`; no bundle de arquivo \u00FAnico, `npm install pptsx` d\u00E1 os tipos ao editor).";
/** Copia os `.d.ts` de `source` (normalmente `typesSourceDir()`) para `<projectDir>/.pptsx/types/pptsx/` e grava o README. */
export declare const writeTypes: (projectDir: string, source: string | undefined) => TypesWritten | undefined;
/** A linha do resumo do `init`/`types`. */
export declare const typesLineOf: (written: TypesWritten) => string;
