import { DEFAULTS } from '../core/defaults.ts';
import type { Dimensions } from '../core/types.ts';
import { dataUriOf } from './image.ts';
import { defaultFamilyOf, rasterize } from './png.ts';
import { element } from './xml.ts';

export interface OverviewItem {
  readonly png: Buffer;
  readonly number: number;
  readonly badge?: 'error' | 'warning';
  /** M15: slide oculto: miniatura esmaecida e "oculto" na legenda. */
  readonly hidden?: boolean;
  /** M15: título da seção que começa neste slide (legenda e marca à esquerda). */
  readonly section?: string;
  /** M17: legenda própria (sem marca de seção), para overviews fora de um deck (catálogo de componentes). */
  readonly label?: string;
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
  badgeRadius: 12,
  badgeInset: 18,
  badgeBorder: 2.5,
  /** M15: véu sobre a miniatura de slide oculto e a marca de início de seção. */
  hiddenVeil: '#FFFFFF',
  hiddenOpacity: 0.6,
  sectionMark: '#2F6FED',
  sectionMarkWidth: 4,
  sectionMarkGap: 6,
  /** Legenda maior que isso (em caracteres) é cortada com "…" para caber sob a miniatura. */
  labelChars: 40,
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

const BADGE_MARK = '#FFFFFF';

/** "!" desenhado com formas (haste + ponto) para não depender de fonte no overview. */
const exclamationSvg = (cx: number, cy: number): string => {
  const r = GRID.badgeRadius;
  const stemWidth = r * 0.28;
  return [
    element('rect', {
      x: cx - stemWidth / 2,
      y: cy - r * 0.6,
      width: stemWidth,
      height: r * 0.75,
      rx: stemWidth / 2,
      fill: BADGE_MARK,
    }),
    element('circle', { cx, cy: cy + r * 0.47, r: stemWidth * 0.62, fill: BADGE_MARK }),
  ].join('');
};

const badgeSvg = (cell: Cell, thumbWidth: number): string => {
  if (cell.item.badge === undefined) return '';
  const cx = cell.x + thumbWidth - GRID.badgeInset;
  const cy = cell.y + GRID.badgeInset;
  const circle = element('circle', {
    cx,
    cy,
    r: GRID.badgeRadius,
    fill: BADGE_COLORS[cell.item.badge],
    stroke: BADGE_MARK,
    'stroke-width': GRID.badgeBorder,
  });
  return circle + exclamationSvg(cx, cy);
};

/** "3", "3 · Resultados", "4 · oculto". */
export const overviewLabelOf = (item: OverviewItem): string => {
  const label = [String(item.number), item.label ?? item.section, item.hidden === true ? 'oculto' : undefined].filter((part) => part !== undefined).join(' · ');
  return label.length > GRID.labelChars ? `${label.slice(0, GRID.labelChars - 1)}…` : label;
};

const veilSvg = (cell: Cell, frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): string =>
  cell.item.hidden === true ? element('rect', { ...frame, fill: GRID.hiddenVeil, 'fill-opacity': GRID.hiddenOpacity }) : '';

const sectionMarkSvg = (cell: Cell): string =>
  cell.item.section === undefined
    ? ''
    : element('rect', { x: cell.x - GRID.sectionMarkGap - GRID.sectionMarkWidth, y: cell.y, width: GRID.sectionMarkWidth, height: cell.height, fill: GRID.sectionMark });

const cellSvg = (cell: Cell, thumbWidth: number, family: string | undefined): string => {
  const frame = { x: cell.x, y: cell.y, width: thumbWidth, height: cell.height };
  return [
    element('image', { ...frame, href: dataUriOf('image/png', cell.item.png), preserveAspectRatio: 'none' }),
    veilSvg(cell, frame),
    sectionMarkSvg(cell),
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
      overviewLabelOf(cell.item),
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
