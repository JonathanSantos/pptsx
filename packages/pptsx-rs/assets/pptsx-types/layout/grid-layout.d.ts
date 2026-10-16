import { type MeasureFunction } from 'yoga-layout';
import type { BoxMetrics, CssStyle, LayoutEnv, PositionedNode, Rect, ResolvedNode } from '../core/types.ts';
import { type Area } from './grid.ts';
/**
 * Grid ↔ Yoga. O contêiner grid é uma folha do Yoga com measure function (largura → altura
 * pela grade); os itens NÃO entram na árvore principal. Depois do layout, cada item é
 * posicionado na sua área por uma árvore Yoga própria do tamanho da área (o grid só decide
 * as áreas; dentro delas o item é uma caixa comum). Contribuições dos itens: min-content
 * (intrinsic.ts), max-content e altura numa largura (Yoga isolado).
 */
/** Contêiner que dispõe filhos em grade (Box ou Slide). */
export interface GridContainer {
    readonly css: CssStyle;
    readonly children: readonly ResolvedNode[];
}
export interface GridModel {
    readonly columns: readonly number[];
    readonly rows: readonly number[];
    /** Uma área por filho em fluxo, na ordem de `items`. */
    readonly areas: readonly Area[];
    readonly items: readonly ResolvedNode[];
}
/**
 * Dimensiona a grade: placement, colunas (com `width` disponível ou indefinida) e depois as
 * linhas, com a altura de cada item medida na largura da sua área (§11.1: colunas primeiro).
 */
export declare const gridModelOf: (container: GridContainer, env: LayoutEnv, width: number | undefined, height: number | undefined) => GridModel;
/** Measure function do contêiner grid: tamanho de conteúdo pela grade. */
export declare const gridMeasureFunc: (container: GridContainer, env: LayoutEnv) => MeasureFunction;
/** Filhos posicionados de um contêiner grid já com frame final (ordem da árvore). */
export declare const layoutGridChildren: (container: GridContainer, frame: Rect, box: BoxMetrics, env: LayoutEnv) => readonly PositionedNode[];
