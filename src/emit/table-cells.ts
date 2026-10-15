import { DEFAULTS, tableStyleOf } from '../core/defaults.ts';
import type { PositionedIcon, PositionedTable, PositionedText, Pt, Rect, ResolvedCell, TextLayout } from '../core/types.ts';

/**
 * Geometria das células da Table (M14-3), comum ao emissor e ao preview: a área de cada célula
 * (com merges), o texto como um Text posicionado na área de conteúdo (padding, ícone e `valign`
 * aplicados) e o ícone como um Icon posicionado. Puro.
 */

export interface PlacedCell {
  readonly row: number;
  readonly col: number;
  readonly cell: ResolvedCell;
  /** Área da célula (as colunas e linhas que ela cobre). */
  readonly rect: Rect;
  readonly layout: TextLayout;
}

/** Posições acumuladas: offsets[i] = início da i-ésima faixa; o último = fim da tabela. */
export const offsetsOf = (start: Pt, sizes: readonly Pt[]): readonly Pt[] =>
  sizes.reduce<readonly Pt[]>((acc, size) => [...acc, (acc[acc.length - 1] ?? start) + size], [start]);

/** Células que desenham (as cobertas por merge ficam de fora), com a área mesclada. */
export const placedCellsOf = (table: PositionedTable): readonly PlacedCell[] => {
  const xs = offsetsOf(table.frame.x, table.columnWidths);
  const ys = offsetsOf(table.frame.y, table.rowHeights);
  return table.grid.flatMap((row, r) =>
    row.flatMap((cell, c) => {
      if (cell.covered) return [];
      const x = xs[c] ?? table.frame.x;
      const y = ys[r] ?? table.frame.y;
      const right = xs[Math.min(c + cell.colSpan, xs.length - 1)] ?? x;
      const bottom = ys[Math.min(r + cell.rowSpan, ys.length - 1)] ?? y;
      const layout = table.cells[r]?.[c];
      return layout === undefined ? [] : [{ row: r, col: c, cell, rect: { x, y, width: right - x, height: bottom - y }, layout }];
    }),
  );
};

const paddingOf = (table: PositionedTable): Pt => table.props.cellPadding ?? DEFAULTS.table.cellPadding;

const VALIGN_SHARE = { top: 0, middle: 0.5, bottom: 1 } as const;

const iconSpaceOf = (cell: ResolvedCell): Pt => (cell.icon === undefined ? 0 : cell.icon.size + DEFAULTS.table.iconGap);

/** Conteúdo da célula: dentro do padding; o ícone ocupa o início. */
const innerOf = (table: PositionedTable, placed: PlacedCell): Rect => {
  const padding = paddingOf(table);
  return {
    x: placed.rect.x + padding,
    y: placed.rect.y + padding,
    width: Math.max(0, placed.rect.width - 2 * padding),
    height: Math.max(0, placed.rect.height - 2 * padding),
  };
};

/** Deslocamento vertical do bloco de altura `height` na área interna, pelo `valign`. */
const valignOffsetOf = (placed: PlacedCell, inner: Rect, height: Pt): Pt => Math.max(0, inner.height - height) * VALIGN_SHARE[placed.cell.valign];

/**
 * A célula como um Text posicionado: frame = área do texto (depois do ícone, com o `valign`
 * aplicado à altura do texto), props com a família/corpo/alinhamento da tabela e os runs da célula.
 */
export const cellTextOf = (table: PositionedTable, placed: PlacedCell): PositionedText => {
  const inner = innerOf(table, placed);
  const space = iconSpaceOf(placed.cell);
  const style = tableStyleOf(table.props);
  const frame: Rect = {
    x: inner.x + space,
    y: inner.y + valignOffsetOf(placed, inner, placed.layout.height),
    width: Math.max(0, inner.width - space),
    height: placed.layout.height,
  };
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    kind: 'text',
    path: `${table.path} > Cell[${placed.row},${placed.col}]`,
    css: table.css,
    props: { font: style.family, size: table.fontSize, lineHeight: style.lineHeight, align: placed.cell.align, color: table.props.color },
    content: placed.cell.text,
    runs: placed.cell.runs,
    frame,
    box: { margin: zero, border: zero, padding: zero },
    text: placed.layout,
  };
};

/** O ícone da célula como um Icon posicionado (no início da área interna, centrado na 1ª linha ou pelo valign). */
export const cellIconOf = (table: PositionedTable, placed: PlacedCell): PositionedIcon | undefined => {
  const icon = placed.cell.icon;
  if (icon === undefined) return undefined;
  const inner = innerOf(table, placed);
  const block = Math.max(icon.size, placed.layout.height);
  const top = inner.y + valignOffsetOf(placed, inner, block);
  const lineTop = Math.max(0, (Math.min(placed.layout.lineHeight, block) - icon.size) / 2);
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    kind: 'icon',
    path: `${table.path} > Cell[${placed.row},${placed.col}] > Icon`,
    css: table.css,
    props: { src: '', size: icon.size, color: icon.color },
    viewBox: icon.viewBox,
    content: icon.content,
    frame: { x: inner.x, y: top + lineTop, width: icon.size, height: icon.size },
    box: { margin: zero, border: zero, padding: zero },
  };
};
