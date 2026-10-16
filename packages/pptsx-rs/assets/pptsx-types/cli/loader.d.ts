export interface UserModule {
    readonly default?: unknown;
}
export interface ImportOptions {
    /** true = grafo de módulos novo (deck e tudo que ele importa), isolado do cache ESM; usado pelo --watch. */
    readonly fresh: boolean;
    /** cwd do runCli: decide o tsconfig do namespace quando fresh. */
    readonly cwd: string;
}
/** Importa o deck/config do usuário; injetável em CliDeps para os testes não dependerem do tsx. */
export type ImportModule = (file: string, options: ImportOptions) => Promise<UserModule>;
/**
 * M16 (M9-E): o tsconfig que compila um arquivo do usuário é o mais próximo da pasta dele (o mesmo que
 * `assertDeckTsconfig` valida); sem nenhum acima, o do cwd/pacote.
 */
export declare const tsconfigForFile: (file: string, cwd: string) => string;
/**
 * Padrão: `import()` normal (sem custo, compilado com o tsconfig do cwd pelo register global) ou um
 * namespace novo do tsx — com `fresh`, ou quando o arquivo tem tsconfig próprio diferente do do cwd
 * (deck fora do cwd com `jsxImportSource` próprio dava "React is not defined").
 */
export declare const defaultImportModule: ImportModule;
