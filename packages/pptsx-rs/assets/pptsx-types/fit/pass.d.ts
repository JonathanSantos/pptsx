import type { LayoutEnv, PositionedNode, PositionedSlide, PositionedTable, PositionedText, Pt, ResolvedNode, ResolvedSlide, ResolvedTable, ResolvedText, SlideSize } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import type { OverflowPolicy } from './policies.ts';
import type { ResolvedShrinkable, Shrinkable } from './shrinkable.ts';
export interface LayoutInput {
    readonly size: SlideSize;
    readonly env: LayoutEnv;
}
/**
 * O que vale para o Text (ou Table) durante todo o ajuste, lido das props ORIGINAIS do
 * autor. A busca só usa `triggersShrink`/`resize` da política; os diagnósticos da Table
 * são próprios (ver table.ts).
 */
export interface ShrinkPlan {
    readonly from: Pt;
    /** Nunca acima de `from`: o ajuste não aumenta texto que o autor já fez menor que o piso. */
    readonly min: Pt;
    readonly policy: OverflowPolicy;
}
export type Plans = ReadonlyMap<string, ShrinkPlan>;
export interface Pass {
    readonly resolved: ResolvedSlide;
    readonly positioned: PositionedSlide;
    readonly overflows: readonly Overflow[];
}
export declare const sizeOf: (text: ResolvedText) => Pt;
export declare const resolvedTexts: (nodes: readonly ResolvedNode[]) => readonly ResolvedText[];
export declare const resolvedTables: (nodes: readonly ResolvedNode[]) => readonly ResolvedTable[];
/** Text e Table na ordem do slide. */
export declare const resolvedShrinkables: (nodes: readonly ResolvedNode[]) => readonly ResolvedShrinkable[];
export declare const positionedNodes: (nodes: readonly PositionedNode[]) => readonly PositionedNode[];
export declare const positionedTexts: (pass: Pass) => readonly PositionedText[];
export declare const positionedTables: (pass: Pass) => readonly PositionedTable[];
/** Visão comum (ver shrinkable.ts) de cada Text e Table posicionado, na ordem do slide. */
export declare const positionedShrinkables: (pass: Pass) => readonly Shrinkable[];
export declare const plansOf: (slide: ResolvedSlide) => Plans;
export declare const passOf: (resolved: ResolvedSlide, input: LayoutInput) => Pass;
/** Estouros de altura dos Text (um Text pode ter também um de largura: mapas separados). */
export declare const textOverflowsOf: (pass: Pass) => ReadonlyMap<string, Overflow>;
export declare const tableOverflowsOf: (pass: Pass) => ReadonlyMap<string, Overflow>;
/** Estouros de altura de Text e Table: o que dispara a busca mesmo no mínimo. */
export declare const heightOverflowsOf: (pass: Pass) => ReadonlyMap<string, Overflow>;
/** Estouros de largura (Text com nowrap). */
export declare const widthOverflowsOf: (pass: Pass) => ReadonlyMap<string, Overflow>;
/** Text/Table com qualquer estouro: não contam para o box do pai (mesma regra da detecção). */
export declare const explainedPaths: (pass: Pass) => ReadonlySet<string>;
