import { DEFAULTS } from '../core/defaults.ts';
import { cellIconOf, cellTextOf, placedCellsOf } from '../emit/table-cells.ts';
import { iconSvg } from './vector.ts';
import type { Color, PositionedTable, Rect } from '../core/types.ts';
import { rectAttrs, textSvg, type TextSvgOptions } from './svg.ts';
import { element } from './xml.ts';

/**
 * Tabela no preview: fundos, grade e texto já quebrado pelo layout (cells). O SVG não
 * decide quebra nem altura: só desenha rowHeights/columnWidths e recorta pelo frame.
 */

const round = (value: number): number => Math.round(value * 1000) / 1000;

interface Segment {
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

/** Junta trechos da mesma reta que se tocam: uma linha por trecho contínuo. */
const mergeSegments = (segments: readonly Segment[]): readonly Segment[] => {
  const byLine = new Map<number, Segment[]>();
  segments.forEach((segment) => byLine.set(segment.at, [...(byLine.get(segment.at) ?? []), segment]));
  return [...byLine.values()].flatMap((line) =>
    [...line]
      .sort((a, b) => a.from - b.from)
      .reduce<Segment[]>((merged, segment) => {
        const last = merged[merged.length - 1];
        if (last !== undefined && segment.from <= last.to + 1e-6) {
          merged[merged.length - 1] = { ...last, to: Math.max(last.to, segment.to) };
          return merged;
        }
        return [...merged, segment];
      }, []),
  );
};

/**
 * Grade pelas arestas das células desenhadas: a mesclada não tem linha por dentro, e a aresta
 * compartilhada sai uma vez só (trechos contínuos viram uma linha).
 */
const gridSvg = (rects: readonly Rect[], border: Color): string => {
  const horizontal = mergeSegments(rects.flatMap(({ x, y, width, height }) => [{ at: round(y), from: round(x), to: round(x + width) }, { at: round(y + height), from: round(x), to: round(x + width) }]));
  const vertical = mergeSegments(rects.flatMap(({ x, y, width, height }) => [{ at: round(x), from: round(y), to: round(y + height) }, { at: round(x + width), from: round(y), to: round(y + height) }]));
  const stroke = { stroke: border, 'stroke-width': DEFAULTS.table.borderWidth, 'stroke-linecap': 'square' };
  return [
    ...horizontal.map((s) => element('line', { x1: s.from, y1: s.at, x2: s.to, y2: s.at, ...stroke })),
    ...vertical.map((s) => element('line', { x1: s.at, y1: s.from, x2: s.at, y2: s.to, ...stroke })),
  ].join('');
};

/**
 * Clip só embaixo: a grade nas bordas laterais e no topo fica inteira (metade do traço
 * sairia do frame), mas nada passa de frame.y + frame.height.
 */
const clipRectOf = (frame: Rect): Rect => {
  const bleed = DEFAULTS.table.borderWidth;
  return { x: frame.x - bleed, y: frame.y - bleed, width: frame.width + 2 * bleed, height: frame.height + bleed };
};

const isVisible = (rect: Rect, frame: Rect): boolean => rect.y < frame.y + frame.height;

/** M14: fundos por célula, bordas, texto por trecho (o mesmo desenho do Text) e ícones. */
export const tableSvg = (node: PositionedTable, options: TextSvgOptions = {}, clipId = 'table-clip'): string => {
  const cells = placedCellsOf(node).filter((placed) => isVisible(placed.rect, node.frame));
  const fills = cells.map((placed) => (placed.cell.fill === undefined ? '' : element('rect', { ...rectAttrs(placed.rect), fill: placed.cell.fill }))).join('');
  const borders = node.props.border === undefined ? '' : gridSvg(placedCellsOf(node).map((placed) => placed.rect), node.props.border);
  const texts = cells.map((placed) => textSvg(cellTextOf(node, placed), options)).join('');
  const icons = cells
    .map((placed, index) => {
      const icon = cellIconOf(node, placed);
      return icon === undefined ? '' : iconSvg(icon, index);
    })
    .join('');
  const clip = element('clipPath', { id: clipId }, element('rect', rectAttrs(clipRectOf(node.frame))));
  return `${element('defs', {}, clip)}${element('g', { 'clip-path': `url(#${clipId})` }, fills + borders + texts + icons)}`;
};

/**
 * Debug: faixa da tabela abaixo do frame quando a altura pedida passa dele (mesma tolerância
 * do fit). Célula com fonte ausente tem medição estimada: o fit só reporta font-missing.
 */
export const tableOverflowRectOf = (node: PositionedTable): Rect | undefined => {
  const { frame } = node;
  if (node.cells.some((row) => row.some((cell) => cell.fontMissing))) return undefined;
  if (node.height <= frame.height + DEFAULTS.fit.epsilon) return undefined;
  return { x: frame.x, y: frame.y + frame.height, width: frame.width, height: node.height - frame.height };
};
