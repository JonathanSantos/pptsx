import { DEFAULTS, tableHeaderOf, tableStyleOf } from '../core/defaults.ts';
import type { Color, FontWeight, PositionedTable, Pt, Rect, TableHeaderStyle, TextLayout } from '../core/types.ts';
import { ANCHORS, rectAttrs, type TextSvgOptions } from './svg.ts';
import { element, escapeXml, type Attrs } from './xml.ts';

/**
 * Tabela no preview: fundos, grade e texto já quebrado pelo layout (cells). O SVG não
 * decide quebra nem altura: só desenha rowHeights/columnWidths e recorta pelo frame.
 */

/** Cabeçalho sem weight explícito é negrito (mesma regra do layout ao medir). */
const HEADER_FALLBACK_WEIGHT: FontWeight = 'bold';

interface CellBox {
  readonly row: number;
  readonly col: number;
  readonly rect: Rect;
}

interface RowPaint {
  readonly fill?: Color;
  readonly color: Color;
  readonly weight: FontWeight;
}

/** Posições acumuladas: offsets[i] = início da i-ésima faixa; o último = fim da tabela. */
const offsetsOf = (start: Pt, sizes: readonly Pt[]): readonly Pt[] =>
  sizes.reduce<readonly Pt[]>((acc, size) => [...acc, (acc[acc.length - 1] ?? start) + size], [start]);

const cellBoxesOf = (node: PositionedTable): readonly CellBox[] => {
  const xs = offsetsOf(node.frame.x, node.columnWidths);
  const ys = offsetsOf(node.frame.y, node.rowHeights);
  return node.rowHeights.flatMap((height, row) =>
    node.columnWidths.map((width, col) => ({
      row,
      col,
      rect: { x: xs[col] ?? node.frame.x, y: ys[row] ?? node.frame.y, width, height },
    })),
  );
};

/** Zebra conta só linhas de dados: a 2ª, 4ª… (índice ímpar) recebem stripe. */
const rowPaintOf = (node: PositionedTable, header: TableHeaderStyle | undefined, row: number): RowPaint => {
  const color = node.props.color ?? DEFAULTS.text.color;
  if (header !== undefined && row === 0) {
    return { fill: header.fill, color: header.color ?? color, weight: header.weight ?? HEADER_FALLBACK_WEIGHT };
  }
  const dataIndex = header === undefined ? row : row - 1;
  return { fill: dataIndex % 2 === 1 ? node.props.stripe : undefined, color, weight: tableStyleOf(node.props).weight };
};

const fillSvg = (cell: CellBox, paint: RowPaint): string =>
  paint.fill === undefined ? '' : element('rect', { ...rectAttrs(cell.rect), fill: paint.fill });

/** Grade inteira em linhas (não stroke por célula): borda compartilhada sai uma vez só. */
const gridSvg = (node: PositionedTable, border: Color): string => {
  const xs = offsetsOf(node.frame.x, node.columnWidths);
  const ys = offsetsOf(node.frame.y, node.rowHeights);
  const left = xs[0] ?? node.frame.x;
  const right = xs[xs.length - 1] ?? left;
  const top = ys[0] ?? node.frame.y;
  const bottom = ys[ys.length - 1] ?? top;
  const stroke: Attrs = { stroke: border, 'stroke-width': DEFAULTS.table.borderWidth, 'stroke-linecap': 'square' };
  const horizontal = ys.map((y) => element('line', { x1: left, y1: y, x2: right, y2: y, ...stroke }));
  const vertical = xs.map((x) => element('line', { x1: x, y1: top, x2: x, y2: bottom, ...stroke }));
  return [...horizontal, ...vertical].join('');
};

/** Mesma regra do textSvg, deslocada pelo padding da célula. */
const cellTextSvg = (cell: CellBox, layout: TextLayout, paint: RowPaint, common: Attrs, node: PositionedTable): string => {
  const padding = node.props.cellPadding ?? DEFAULTS.table.cellPadding;
  const align = node.props.columns[cell.col]?.align ?? DEFAULTS.text.align;
  const { anchor, offset } = ANCHORS[align];
  const innerWidth = Math.max(0, cell.rect.width - 2 * padding);
  const x = cell.rect.x + padding + innerWidth * offset;
  const top = cell.rect.y + padding;
  const attrs: Attrs = {
    ...common,
    x,
    'text-anchor': anchor,
    'font-weight': paint.weight === 'bold' ? 'bold' : 'normal',
    fill: paint.color,
  };
  return layout.lines
    .map((line, i) => element('text', { ...attrs, y: top + i * layout.lineHeight + layout.ascent }, escapeXml(line)))
    .join('');
};

/**
 * Clip só embaixo: a grade nas bordas laterais e no topo fica inteira (metade do traço
 * sairia do frame), mas nada passa de frame.y + frame.height.
 */
const clipRectOf = (frame: Rect): Rect => {
  const bleed = DEFAULTS.table.borderWidth;
  return { x: frame.x - bleed, y: frame.y - bleed, width: frame.width + 2 * bleed, height: frame.height + bleed };
};

const isVisible = (cell: CellBox, frame: Rect): boolean => cell.rect.y < frame.y + frame.height;

export const tableSvg = (node: PositionedTable, options: TextSvgOptions = {}, clipId = 'table-clip'): string => {
  const header = tableHeaderOf(node.props);
  const style = tableStyleOf(node.props);
  const cells = cellBoxesOf(node).filter((cell) => isVisible(cell, node.frame));
  const common: Attrs = {
    'font-family': options.fontFamilyMap?.[style.family] ?? style.family,
    'font-size': node.fontSize,
    'font-style': 'normal',
    'xml:space': 'preserve',
  };
  const paints = node.rowHeights.map((_, row) => rowPaintOf(node, header, row));
  const fallbackPaint = rowPaintOf(node, undefined, 0);
  const paintOf = (cell: CellBox): RowPaint => paints[cell.row] ?? fallbackPaint;
  const fills = cells.map((cell) => fillSvg(cell, paintOf(cell))).join('');
  const grid = node.props.border === undefined ? '' : gridSvg(node, node.props.border);
  const texts = cells
    .map((cell) => {
      const layout = node.cells[cell.row]?.[cell.col];
      return layout === undefined ? '' : cellTextSvg(cell, layout, paintOf(cell), common, node);
    })
    .join('');
  const clip = element('clipPath', { id: clipId }, element('rect', rectAttrs(clipRectOf(node.frame))));
  return `${element('defs', {}, clip)}${element('g', { 'clip-path': `url(#${clipId})` }, fills + grid + texts)}`;
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
