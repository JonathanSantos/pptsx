import type { Diagnostic, PositionedNode, Pt, TextStyle } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import type { ContainerExcess, SideExcess } from './geometry.ts';
export interface DiagnosticContext {
    /** SlideSize.name */
    readonly size: string;
    /** Índice do slide, começando em 1. */
    readonly slide: number;
}
/** 1 casa decimal, sem ".0" sobrando. */
export declare const round: (value: number) => number;
export declare const textShrunk: (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt) => Diagnostic;
/**
 * shrink que ainda estoura. A busca só desiste no mínimo; acima dele só sobra o caso
 * raro de esgotar as rodadas, que não pede ação diferente do autor.
 */
export declare const textOverflowShrunk: (ctx: DiagnosticContext, overflow: Overflow, sizes: {
    readonly from: Pt;
    readonly to: Pt;
    readonly min: Pt;
}) => Diagnostic;
/** Com área 0 pt o conteúdo não é o problema: falar em minSize ou em encurtar desviaria o autor. */
export declare const withZeroArea: (diagnostic: Diagnostic, available: Pt) => Diagnostic;
/** Estouro que só existe porque outro nó tomou o espaço: aponta a causa para o autor corrigir primeiro. */
export declare const withCause: (diagnostic: Diagnostic, cause: {
    readonly path: string;
    readonly demand: Pt;
}) => Diagnostic;
/** Irmão de uma linha nowrap que tomou a largura da row: o autor corrige o nowrap primeiro. */
export declare const withWidthCause: (diagnostic: Diagnostic, cause: {
    readonly path: string;
    readonly overflowPt: Pt;
}) => Diagnostic;
export declare const textIllegible: (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt) => Diagnostic;
export declare const textOverflowKept: (ctx: DiagnosticContext, overflow: Overflow, size: Pt) => Diagnostic;
/** shrink com nowrap que ainda passa da largura (normalmente já no mínimo). */
export declare const textOverflowWidthShrunk: (ctx: DiagnosticContext, overflow: Overflow, lineWidth: Pt, sizes: {
    readonly from: Pt;
    readonly to: Pt;
    readonly min: Pt;
}) => Diagnostic;
declare const KEPT_REASON: {
    readonly error: 'fit="error" não ajusta';
    readonly truncate: 'fit="truncate" só corta linhas, não largura';
};
/** Políticas que não encolhem: a largura fica como o autor escreveu. */
export declare const textOverflowWidthKept: (ctx: DiagnosticContext, overflow: Overflow, lineWidth: Pt, size: Pt, policy: keyof typeof KEPT_REASON) => Diagnostic;
/** Sobra depois de truncar: nem uma linha cabe na caixa. */
export declare const textOverflowTruncated: (ctx: DiagnosticContext, overflow: Overflow) => Diagnostic;
/** Linhas mostradas (com reticências) contra as linhas do texto inteiro na mesma largura. */
export declare const textTruncated: (ctx: DiagnosticContext, path: string, lines: {
    readonly shown: number;
    readonly total: number;
}) => Diagnostic;
/** Palavra quebrada por caractere que sobreviveu ao ajuste (ou que o fit da política não tenta resolver). */
export declare const textWordBroken: (ctx: DiagnosticContext, path: string, broken: {
    readonly words: readonly string[];
    readonly from: Pt;
    readonly to: Pt;
    readonly width: Pt;
}) => Diagnostic;
export declare const fontMissing: (ctx: DiagnosticContext, path: string, style: TextStyle) => Diagnostic;
/** M13: peso pedido sem face próxima; o texto sai com a face de `used`. */
export declare const fontWeightFallback: (ctx: DiagnosticContext, path: string, family: string, weights: {
    readonly requested: number;
    readonly used: number;
}) => Diagnostic;
/** M14: ícone em célula de tabela é uma forma sobre a tabela, não parte dela. */
export declare const tableCellIcon: (ctx: DiagnosticContext, path: string) => Diagnostic;
export interface TableRows {
    /** Linhas de dados inteiramente visíveis (o cabeçalho não conta). */
    readonly shown: number;
    readonly total: number;
}
export declare const tableShrunk: (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt) => Diagnostic;
export declare const tableIllegible: (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt) => Diagnostic;
/** shrink que ainda estoura (normalmente já no mínimo; acima dele só se as rodadas acabaram). */
export declare const tableOverflowShrunk: (ctx: DiagnosticContext, overflow: Overflow, sizes: {
    readonly from: Pt;
    readonly to: Pt;
    readonly min: Pt;
}, rows: TableRows) => Diagnostic;
export declare const tableOverflowKept: (ctx: DiagnosticContext, overflow: Overflow, size: Pt, rows: TableRows) => Diagnostic;
export interface BrokenColumn {
    /** `columns[c].header` */
    readonly header: string;
    readonly words: readonly string[];
    /** Largura em que as células da coluna quebram (coluna − 2 × cellPadding). */
    readonly width: Pt;
}
/** Palavra de célula quebrada por caractere que sobreviveu ao ajuste. */
export declare const tableWordBroken: (ctx: DiagnosticContext, path: string, broken: {
    readonly columns: readonly BrokenColumn[];
    readonly from: Pt;
    readonly to: Pt;
}) => Diagnostic;
export declare const boxOverflow: (ctx: DiagnosticContext, overflow: Overflow, excess: ContainerExcess) => Diagnostic;
/** M11: item de grid maior que a célula (track fixo ou fr que não cresce com o conteúdo). */
export declare const cellOverflow: (ctx: DiagnosticContext, overflow: Overflow, node: PositionedNode) => Diagnostic;
export declare const outOfSlide: (ctx: DiagnosticContext, overflow: Overflow, sides: readonly SideExcess[]) => Diagnostic;
export declare const imageUpscaled: (ctx: DiagnosticContext, path: string, drawn: {
    readonly width: Pt;
    readonly natural: Pt;
    readonly pixels: number;
}) => Diagnostic;
export declare const slideContinued: (ctx: DiagnosticContext, path: string, pagination: {
    readonly sourceSlide: number;
    readonly items: readonly number[];
    readonly kind?: 'box' | 'text' | 'table';
}) => Diagnostic;
/** O box-overflow que o fit já deu em P ganha a frase de parada. */
export declare const withPaginationStop: (diagnostic: Diagnostic, maxParts: number) => Diagnostic;
/** Sem box-overflow do fit em P (o shrink pode ter feito caber): o limite ainda precisa ser dito ao autor. */
export declare const paginationLimit: (ctx: DiagnosticContext, path: string, remaining: number, maxParts: number) => Diagnostic;
export declare const withSourceSlide: (diagnostic: Diagnostic, sourceSlide: number) => Diagnostic;
/** M15: o layout declara placeholders que o 1º slide dele não marca; o PowerPoint mostra a caixa vazia em "Novo slide". */
export declare const placeholderUnused: (ctx: DiagnosticContext, path: string, layout: string, placeholders: readonly string[]) => Diagnostic;
export {};
