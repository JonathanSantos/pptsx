import { DEFAULTS } from '../core/defaults.ts';
import type { Dimensions } from '../core/types.ts';
import { dataUriOf } from './image.ts';
import { defaultFamilyOf, rasterize } from './png.ts';
import { element } from './xml.ts';

export interface OverviewItem {
  readonly png: Buffer;
  readonly number: number;
  readonly badge?: 'error' | 'warning';
}

export interface OverviewOptions {
  readonly columns?: number;
  readonly thumbWidth?: number;
  /** Fontes para o número do slide; sem elas o número não aparece (sem fontes do sistema). */
  readonly fontFiles?: readonly string[];
}

/** Medidas da grade em px. */
const GRID = {
  margin: 24,
  gap: 24,
  labelGap: 6,
  labelSize: 14,
  labelHeight: 22,
  background: '#EEEEEE',
  border: '#C8C8C8',
  label: '#444444',
  badgeRadius: 9,
  badgeInset: 14,
} as const;

const BADGE_COLORS: Readonly<Record<NonNullable<OverviewItem['badge']>, string>> = {
  error: '#E02424',
  warning: '#F5B800',
};

/** IHDR vem logo após a assinatura de 8 bytes: width/height big-endian nos offsets 16 e 20. */
export const pngDimensionsOf = (png: Buffer): Dimensions => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

interface Cell {
  readonly item: OverviewItem;
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

const chunk = <T>(list: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const thumbHeightOf = (png: Buffer, thumbWidth: number): number => {
  const { width, height } = pngDimensionsOf(png);
  return width > 0 ? (thumbWidth * height) / width : thumbWidth;
};

/** Cada linha tem a altura da maior miniatura, para slides de proporções mistas. */
const layoutCells = (items: readonly OverviewItem[], columns: number, thumbWidth: number) => {
  const rows = chunk(items, columns);
  const rowStep = (height: number) => height + GRID.labelGap + GRID.labelHeight + GRID.gap;
  const { cells, y } = rows.reduce<{ readonly cells: readonly Cell[]; readonly y: number }>(
    (acc, row) => {
      const heights = row.map((item) => thumbHeightOf(item.png, thumbWidth));
      const rowCells = row.map((item, col) => ({
        item,
        x: GRID.margin + col * (thumbWidth + GRID.gap),
        y: acc.y,
        height: heights[col] ?? 0,
      }));
      return { cells: [...acc.cells, ...rowCells], y: acc.y + rowStep(Math.max(0, ...heights)) };
    },
    { cells: [], y: GRID.margin },
  );
  const usedColumns = Math.min(columns, items.length);
  const width = GRID.margin * 2 + usedColumns * thumbWidth + Math.max(0, usedColumns - 1) * GRID.gap;
  const height = rows.length === 0 ? GRID.margin * 2 : y - GRID.gap + GRID.margin;
  return { cells, width: Math.max(width, GRID.margin * 2 + thumbWidth), height };
};

const badgeSvg = (cell: Cell, thumbWidth: number): string => {
  if (cell.item.badge === undefined) return '';
  return element('circle', {
    cx: cell.x + thumbWidth - GRID.badgeInset,
    cy: cell.y + GRID.badgeInset,
    r: GRID.badgeRadius,
    fill: BADGE_COLORS[cell.item.badge],
    stroke: '#FFFFFF',
    'stroke-width': 2,
  });
};

const cellSvg = (cell: Cell, thumbWidth: number, family: string | undefined): string => {
  const frame = { x: cell.x, y: cell.y, width: thumbWidth, height: cell.height };
  return [
    element('image', { ...frame, href: dataUriOf('image/png', cell.item.png), preserveAspectRatio: 'none' }),
    element('rect', { ...frame, fill: 'none', stroke: GRID.border, 'stroke-width': 1 }),
    badgeSvg(cell, thumbWidth),
    element(
      'text',
      {
        x: cell.x + thumbWidth / 2,
        y: cell.y + cell.height + GRID.labelGap + GRID.labelSize,
        'text-anchor': 'middle',
        'font-family': family,
        'font-size': GRID.labelSize,
        fill: GRID.label,
      },
      String(cell.item.number),
    ),
  ].join('');
};

export const overviewSvg = (
  items: readonly OverviewItem[],
  options: OverviewOptions = {},
  family?: string,
): string => {
  const columns = Math.max(1, options.columns ?? DEFAULTS.preview.overviewColumns);
  const thumbWidth = options.thumbWidth ?? DEFAULTS.preview.thumbWidth;
  const { cells, width, height } = layoutCells(items, columns, thumbWidth);
  const body = [
    element('rect', { x: 0, y: 0, width, height, fill: GRID.background }),
    ...cells.map((cell) => cellSvg(cell, thumbWidth, family)),
  ].join('');
  return element('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${width} ${height}`, width, height }, body);
};

export const buildOverview = (items: readonly OverviewItem[], options: OverviewOptions = {}): Buffer => {
  const fontFiles = options.fontFiles ?? [];
  return rasterize(overviewSvg(items, options, defaultFamilyOf(fontFiles)), fontFiles);
};
