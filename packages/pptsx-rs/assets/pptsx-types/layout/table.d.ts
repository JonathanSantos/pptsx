import type { LayoutEnv, Pt, ResolvedTable, TableColumn, TextLayout } from '../core/types.ts';
/** Medição da tabela numa largura: tudo que o read e o fit precisam (ver CONTRACTS §M10-B). */
export interface TableLayout {
    readonly columnWidths: readonly Pt[];
    readonly rowHeights: readonly Pt[];
    readonly cells: readonly (readonly TextLayout[])[];
    readonly height: Pt;
    readonly width: Pt;
}
/**
 * Colunas em pt/% ficam fixas; as livres dividem igualmente o que sobra. Sem livre (ou
 * com as fixas passando da largura, quando as livres ficam com 0) escala tudo para a
 * soma fechar `tableWidth`. Largura não finita: não há o que dividir, livres e `%` dão 0
 * (a largura natural depende das células: é o `measureTable` que a calcula).
 */
export declare const columnWidthsOf: (columns: readonly TableColumn[], tableWidth: Pt) => readonly Pt[];
/** Mede a tabela na largura dada (`Infinity` = largura natural pelo conteúdo). */
export declare const measureTable: (table: ResolvedTable, width: Pt, env: LayoutEnv) => TableLayout;
/** Largura natural de um espaço na face da tabela: "x x" − "xx" (o medidor apara espaço no fim da linha). */
export declare const spaceWidthOf: (table: ResolvedTable, env: LayoutEnv) => Pt;
