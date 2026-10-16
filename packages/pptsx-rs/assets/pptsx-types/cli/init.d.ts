import { type DsDeckSource } from './ds-scaffold.ts';
import { type ScaffoldFile } from './scaffold.ts';
export declare const INIT_USAGE = "uso: pptsx init [dir] [--ds <pacote|caminho>] [--force] [--json]";
export interface InitArgs {
    readonly dir: string;
    readonly force: boolean;
    readonly json: boolean;
    /** M18-4: o design system que o deck inicial usa (pacote instalado ou caminho). */
    readonly ds?: string;
}
/** O que o init vai gravar e o que preserva do usuário. */
export interface InitPlan {
    readonly writes: readonly ScaffoldFile[];
    readonly kept: readonly string[];
    readonly warnings: readonly string[];
    /** Subconjunto de `writes` que já existia (sobrescrito com --force ou mesclado). */
    readonly updated: readonly string[];
}
export interface InitReport {
    readonly files: readonly string[];
}
export declare const parseInitCli: (argv: readonly string[], cwd?: string) => InitArgs;
export declare const deckExistsMessage: (deckPath: string) => string;
/**
 * `existing` mapeia caminho relativo → conteúdo atual dos arquivos que já existem.
 * Sem --force, um deck.tsx existente aborta; os demais arquivos existentes são mantidos.
 */
export declare const planInit: (files: readonly ScaffoldFile[], existing: ReadonlyMap<string, string>, force: boolean, deckPath?: string, dirName?: string) => InitPlan;
export declare const nextStepsOf: (dir: string, cwd: string) => readonly string[];
export declare const initSummaryOf: (dir: string, plan: InitPlan, cwd: string) => string;
export declare const initJsonOf: (dir: string, plan: InitPlan) => string;
/** Carrega o módulo do DS e devolve o que o deck inicial precisa saber dele. */
export declare const loadDsSource: (spec: string, dir: string, cwd: string) => Promise<DsDeckSource>;
/** Cria/atualiza os arquivos do projeto e devolve o plano; não imprime (o MCP usa por stdio). */
export declare const applyInit: (args: Pick<InitArgs, 'dir' | 'force'>, source?: DsDeckSource) => InitPlan;
export declare const runInit: (args: InitArgs, cwd: string) => Promise<number>;
