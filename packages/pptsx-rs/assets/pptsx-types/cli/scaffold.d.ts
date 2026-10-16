/** Arquivos que `pptsx init` cria; só dados, o IO fica em init.ts. */
export interface ScaffoldFile {
    /** Relativo ao diretório do projeto, com `/`. */
    readonly path: string;
    readonly content: string;
}
export declare const DECK_FILE = "deck.tsx";
export declare const GITIGNORE_FILE = ".gitignore";
export declare const TSCONFIG_FILE = "tsconfig.json";
export declare const GITIGNORE_ENTRY = "dist/";
export declare const NEXT_COMMAND = "npx pptsx build deck.tsx --size 16x9,4x3";
export declare const gitignoreContent: (existing?: string) => string;
export declare const PACKAGE_FILE = "package.json";
/** Nome de pacote npm válido a partir do nome da pasta (minúsculas, sem espaços nem símbolos). */
export declare const packageNameOf: (dirName: string) => string;
export declare const packageJsonContent: (dirName: string) => string;
export declare const COMMONJS_SWITCHED_WARNING: string;
export declare const unknownTypeWarningOf: (type: unknown) => string;
export declare const invalidPackageWarning = "package.json n\u00E3o \u00E9 um JSON v\u00E1lido; mantido como est\u00E1. Adicione \"type\": \"module\" \u00E0 m\u00E3o.";
export type PackageJsonMerge = {
    readonly kind: 'write';
    readonly content: string;
    readonly warning?: string;
} | {
    readonly kind: 'keep';
} | {
    readonly kind: 'warn';
    readonly warning: string;
};
/**
 * Sem `type` ou com `"commonjs"` (o que `npm init -y` grava no npm 11) vira `"type": "module"`, preservando
 * as demais chaves; a troca de commonjs avisa. Um `type` desconhecido não é tocado, só avisa.
 */
export declare const mergePackageJson: (existing: string | undefined, dirName: string) => PackageJsonMerge;
/** Todos os arquivos do projeto novo, na ordem em que são listados ao usuário. */
export declare const scaffoldFiles: (dirName?: string) => readonly ScaffoldFile[];
