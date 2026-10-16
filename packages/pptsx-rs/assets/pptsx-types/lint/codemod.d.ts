import type * as TS from 'typescript-api';
/**
 * M16-5: `pptsx lint --fix` — reescreve as props antigas em CSS no fonte TSX. Edições de texto nas
 * posições do AST (a formatação do autor fica); só em tags importadas de 'pptsx' (um componente com
 * `size` não é alias). Valor que não é literal só é migrado quando a troca é só de nome; o resto vira
 * aviso. A API do TypeScript entra injetada (o TS 7 não tem API em JS; ver loadTypeScriptApi).
 */
type Ts = typeof TS;
export interface CodemodSkip {
    readonly line: number;
    readonly prop: string;
    readonly reason: string;
}
export interface CodemodResult {
    readonly source: string;
    readonly changes: number;
    readonly skipped: readonly CodemodSkip[];
}
export interface CodemodOptions {
    /** De onde vêm as primitivas; padrão: só o pacote 'pptsx' (no repo, os testes importam de src/). */
    readonly isPptsxModule?: (specifier: string) => boolean;
}
export declare const migrateSource: (ts: Ts, fileName: string, source: string, options?: CodemodOptions) => CodemodResult;
/**
 * A API de compilador em JS: `typescript` até a 6 (o TS 7 é nativo e não a tem) ou o alias
 * `typescript-api` (deste repo). Sem nenhuma, erro com a instalação sugerida.
 */
export declare const loadTypeScriptApi: (candidates?: readonly string[]) => Promise<Ts>;
export {};
