/** O que o deck exige do tsconfig: o tsx usa essas chaves para compilar o JSX contra o pptsx. */
export declare const REQUIRED_JSX = "react-jsx";
export declare const REQUIRED_JSX_IMPORT_SOURCE = "pptsx";
type JsonObject = Readonly<Record<string, unknown>>;
/** JSON com comentários e vírgulas finais; undefined se não for um objeto válido. */
export declare const parseJsonc: (text: string) => JsonObject | undefined;
export declare const tsconfigErrorOf: (deckPath: string) => string;
/**
 * O tsx só aplica um tsconfig aos arquivos do `include` dele: sem estas chaves no tsconfig do projeto o
 * deck compila como JSX clássico ("React is not defined"). Com `extends`, confia (não resolvemos a cadeia).
 */
export declare const tsconfigProblemOf: (tsconfig: unknown, deckPath?: string) => string | undefined;
/** tsconfig.json mais próximo subindo a partir de `dir` (como o tsx/get-tsconfig o encontra). */
export declare const nearestTsconfigOf: (dir: string) => string | undefined;
/** Casca: falha com mensagem legível antes de o import do deck falhar de forma obscura. */
export declare const assertDeckTsconfig: (deckPath: string) => void;
export type TsconfigMerge = {
    readonly kind: 'write';
    readonly content: string;
    readonly warning: string;
} | {
    readonly kind: 'keep';
} | {
    readonly kind: 'warn';
    readonly warning: string;
};
/** tsconfig existente no `init`: completa jsx/jsxImportSource ausentes; valores diferentes ficam e geram aviso. */
export declare const mergeTsconfig: (existing: string) => TsconfigMerge;
export {};
