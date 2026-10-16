import type { Theme } from '../core/types.ts';
import { type ScaffoldFile } from './scaffold.ts';
/**
 * `pptsx init --ds <pacote|caminho>` (M18-4): o deck inicial usa o design system — um slide por componente
 * exportado com caso de catálogo (as props do primeiro caso), cores do tema do DS — e a config registra o DS
 * e o tema. Só dados; quem carrega o módulo e grava é init.ts.
 */
/** Um componente do DS que o deck mostra: o nome exportado e as props de exemplo. */
export interface DsDeckComponent {
    readonly name: string;
    readonly props: Readonly<Record<string, unknown>>;
}
export interface DsDeckSource {
    /** O especificador que o deck e a config importam (o pacote ou um caminho relativo com extensão). */
    readonly importFrom: string;
    readonly dsName: string;
    /** Como o manifesto sai do módulo: export nomeado `ds` ou o default. */
    readonly dsExport: 'named' | 'default';
    readonly theme?: Theme;
    readonly components: readonly DsDeckComponent[];
    /** `extends` do tsconfig quando o deck fica dentro do monorepo do pptsx (paths para o fonte). */
    readonly tsconfigExtends?: string;
    /** Pasta do DS (relativa ao deck) quando ele é um caminho em .ts/.tsx: entra no `include`. */
    readonly dsDir?: string;
}
/** O componente em JSX com as props de um caso do catálogo (o deck do `init --ds` e o ds.md da skill). */
export declare const componentUsageOf: (component: DsDeckComponent) => string;
export declare const dsDeckContent: (source: DsDeckSource) => string;
export declare const dsConfigContent: (source: DsDeckSource) => string;
/** Troca deck, config e tsconfig do scaffold padrão pelos que usam o DS. */
export declare const withDs: (files: readonly ScaffoldFile[], source: DsDeckSource) => readonly ScaffoldFile[];
