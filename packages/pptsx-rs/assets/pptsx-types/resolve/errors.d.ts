/** Erro de estrutura do deck; `path` aponta onde o problema foi encontrado. */
export declare class ResolveError extends Error {
    readonly path: string;
    /** M18-6: o erro é uma prop da 0.x removida (o lint o mostra como `legacy-prop`, com a troca). */
    readonly removedProp: boolean;
    constructor(message: string, path: string, removedProp?: boolean);
}
/**
 * Valor de prop que não pode seguir nem como diagnóstico (ex.: cor ilegível: o pptxgenjs
 * trocaria por preto e o preview mostraria outra coisa). A normalização não conhece o path;
 * o resolve converte em ResolveError com o path e a primitiva.
 */
export declare class InvalidPropError extends Error {
    readonly property: string;
    readonly value: unknown;
    constructor(property: string, value: unknown, expected: string);
}
/** M18-6: prop antiga (alias da 0.x) removida na 1.0; a mensagem traz a troca e o comando que migra. */
export declare class RemovedPropError extends InvalidPropError {
    constructor(property: string, value: unknown, suggestion: string);
}
