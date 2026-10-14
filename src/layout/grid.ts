import type { GridLine, GridPlacement, Rect } from '../core/types.ts';

/**
 * Motor de grid puro: subconjunto do CSS Grid Level 1 (§7 tracks, §8 placement, §11 track
 * sizing). Não sabe nada de Yoga nem de texto: o tamanho de cada item chega por callbacks
 * (`GridItemInput`). Fora do escopo: áreas nomeadas, subgrid, auto-fill/auto-fit, dense,
 * baseline e justify/align-content (a grade fica no início do contêiner).
 */

// ───────────────────────── tracks ─────────────────────────

export type Breadth =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'percent'; readonly value: number }
  | { readonly kind: 'auto' }
  | { readonly kind: 'min-content' }
  | { readonly kind: 'max-content' }
  | { readonly kind: 'fr'; readonly value: number };

export interface TrackSize {
  readonly min: Breadth;
  readonly max: Breadth;
}

const AUTO: Breadth = { kind: 'auto' };
const AUTO_TRACK: TrackSize = { min: AUTO, max: AUTO };
const PERCENT_BASE = 100;

const NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)`;
const FIXED = new RegExp(`^(${NUMBER})(px|pt)?$`);
const PERCENT = new RegExp(`^(${NUMBER})%$`);
const FR = new RegExp(`^(${NUMBER})fr$`);

const parseBreadth = (token: string): Breadth | undefined => {
  if (token === 'auto') return AUTO;
  if (token === 'min-content') return { kind: 'min-content' };
  if (token === 'max-content') return { kind: 'max-content' };
  const fixed = FIXED.exec(token);
  if (fixed) return { kind: 'fixed', value: Number(fixed[1]) };
  const percent = PERCENT.exec(token);
  if (percent) return { kind: 'percent', value: Number(percent[1]) };
  const fr = FR.exec(token);
  return fr ? { kind: 'fr', value: Number(fr[1]) } : undefined;
};

/** `1fr` = minmax(auto, 1fr) (CSS Grid §7.2.4); qualquer outro valor é min = max. */
const singleTrack = (breadth: Breadth): TrackSize => (breadth.kind === 'fr' ? { min: AUTO, max: breadth } : { min: breadth, max: breadth });

/** Separa no nível 0 de parênteses: 'repeat(2, 1fr) 100px' → ['repeat(2, 1fr)', '100px']. */
const splitTopLevel = (text: string, separator: RegExp): readonly string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && separator.test(char)) {
      if (current.trim() !== '') parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
};

const FUNCTION = /^([a-z-]+)\((.*)\)$/;

const parseTrackToken = (token: string): readonly TrackSize[] | undefined => {
  const fn = FUNCTION.exec(token);
  if (fn === null) {
    const breadth = parseBreadth(token);
    return breadth === undefined ? undefined : [singleTrack(breadth)];
  }
  const [, name, body = ''] = fn;
  const args = splitTopLevel(body, /,/);
  if (name === 'minmax' && args.length === 2) {
    const [min, max] = args.map(parseBreadth);
    // fr não vale como mínimo (CSS Grid §7.2.3).
    if (min === undefined || max === undefined || min.kind === 'fr') return undefined;
    return [{ min, max }];
  }
  if (name === 'repeat' && args.length === 2) {
    const count = Number(args[0]);
    const inner = parseTrackList(args[1] ?? '');
    if (!Number.isInteger(count) || count < 1 || inner === undefined) return undefined;
    return Array.from({ length: count }, () => inner).flat();
  }
  return undefined;
};

/** Lista de tracks (`gridTemplateColumns`); undefined = sintaxe fora do subconjunto. */
export const parseTrackList = (text: string | undefined): readonly TrackSize[] | undefined => {
  if (text === undefined || text.trim() === '' || text.trim() === 'none') return [];
  const tracks = splitTopLevel(text.trim(), /\s/).map(parseTrackToken);
  if (tracks.some((track) => track === undefined)) return undefined;
  return (tracks as readonly (readonly TrackSize[])[]).flat();
};

/** `gridAutoRows`: um track (ou lista, repetida em ciclo). */
export const parseAutoTracks = (text: string | undefined): readonly TrackSize[] => {
  const parsed = parseTrackList(text);
  return parsed === undefined || parsed.length === 0 ? [AUTO_TRACK] : parsed;
};

// ───────────────────────── placement ─────────────────────────

export interface Area {
  /** Linhas 0-based: a área ocupa [rowStart, rowEnd) × [columnStart, columnEnd). */
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
}

interface AxisPlacement {
  readonly start?: number;
  readonly span: number;
}

/** Linha do autor (1-based; negativa conta do fim da grade explícita) → índice 0-based. */
const lineIndex = (index: number, explicitTracks: number): number => (index > 0 ? index - 1 : explicitTracks + 1 + index);

/** Uma dimensão de um item: início definido (ou não) e quantos tracks ocupa. */
const axisOf = (placement: GridPlacement, explicitTracks: number): AxisPlacement => {
  const { start, end } = placement;
  const spanOf = (line: GridLine): number => (line.kind === 'span' ? line.count : 1);
  if (start.kind === 'line' && end.kind === 'line') {
    const a = lineIndex(start.index, explicitTracks);
    const b = lineIndex(end.index, explicitTracks);
    // Início depois do fim: o CSS troca os dois; iguais = span 1.
    return { start: Math.max(0, Math.min(a, b)), span: Math.max(1, Math.abs(b - a)) };
  }
  if (start.kind === 'line') return { start: Math.max(0, lineIndex(start.index, explicitTracks)), span: spanOf(end) };
  if (end.kind === 'line') {
    const b = lineIndex(end.index, explicitTracks);
    const span = spanOf(start);
    return { start: Math.max(0, b - span), span };
  }
  return { span: Math.max(spanOf(start), spanOf(end)) };
};

export interface PlacementInput {
  readonly column: GridPlacement;
  readonly row: GridPlacement;
}

/** Ocupação célula a célula; cresce em linhas conforme a necessidade. */
const occupiedKey = (row: number, column: number): string => `${row}:${column}`;

const fits = (occupied: ReadonlySet<string>, row: number, column: number, rowSpan: number, columnSpan: number): boolean => {
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = column; c < column + columnSpan; c += 1) {
      if (occupied.has(occupiedKey(r, c))) return false;
    }
  }
  return true;
};

const occupy = (occupied: Set<string>, area: Area): void => {
  for (let r = area.rowStart; r < area.rowEnd; r += 1) {
    for (let c = area.columnStart; c < area.columnEnd; c += 1) occupied.add(occupiedKey(r, c));
  }
};

export interface Placed {
  readonly areas: readonly Area[];
  readonly columns: number;
  readonly rows: number;
}

/**
 * Placement (CSS Grid §8.5, fluxo `row`, sem `dense`): 1) itens com linha e coluna definidas;
 * 2) itens com linha definida, na 1ª coluna livre daquela linha; 3) o resto pelo cursor, que
 * só avança (sparse). O número de colunas é o explícito ou o que os itens exigirem.
 */
export const placeItems = (items: readonly PlacementInput[], explicitColumns: number, explicitRows: number): Placed => {
  const axes = items.map((item) => ({ column: axisOf(item.column, explicitColumns), row: axisOf(item.row, explicitRows) }));
  const columns = Math.max(
    explicitColumns,
    1,
    ...axes.map(({ column }) => (column.start ?? 0) + column.span),
  );
  const occupied = new Set<string>();
  const areas: (Area | undefined)[] = items.map(() => undefined);
  const areaOf = (row: number, column: number, rowSpan: number, columnSpan: number): Area => ({
    rowStart: row,
    rowEnd: row + rowSpan,
    columnStart: column,
    columnEnd: column + columnSpan,
  });
  const place = (index: number, area: Area): void => {
    areas[index] = area;
    occupy(occupied, area);
  };

  axes.forEach(({ column, row }, index) => {
    if (column.start === undefined || row.start === undefined) return;
    place(index, areaOf(row.start, column.start, row.span, column.span));
  });

  // Linha definida, coluna automática: cursor de coluna por linha (sparse).
  const rowCursors = new Map<number, number>();
  axes.forEach(({ column, row }, index) => {
    if (row.start === undefined || column.start !== undefined) return;
    let col = rowCursors.get(row.start) ?? 0;
    while (col + column.span > columns || !fits(occupied, row.start, col, row.span, column.span)) {
      col += 1;
      if (col + column.span > columns) break;
    }
    const start = Math.min(col, Math.max(0, columns - column.span));
    place(index, areaOf(row.start, start, row.span, column.span));
    rowCursors.set(row.start, start + column.span);
  });

  // Linha automática: o cursor percorre a grade em ordem de leitura.
  let cursorRow = 0;
  let cursorColumn = 0;
  axes.forEach(({ column, row }, index) => {
    if (row.start !== undefined) return;
    if (column.start !== undefined) {
      if (column.start < cursorColumn) cursorRow += 1;
      cursorColumn = column.start;
      while (!fits(occupied, cursorRow, cursorColumn, row.span, column.span)) cursorRow += 1;
      place(index, areaOf(cursorRow, cursorColumn, row.span, column.span));
      return;
    }
    const span = Math.min(column.span, columns);
    for (;;) {
      if (cursorColumn + span > columns) {
        cursorRow += 1;
        cursorColumn = 0;
        continue;
      }
      if (fits(occupied, cursorRow, cursorColumn, row.span, span)) break;
      cursorColumn += 1;
    }
    place(index, areaOf(cursorRow, cursorColumn, row.span, span));
    cursorColumn += span;
  });

  const placed = areas as readonly Area[];
  const rows = Math.max(explicitRows, ...placed.map((area) => area.rowEnd));
  return { areas: placed, columns, rows };
};

// ───────────────────────── track sizing ─────────────────────────

/** Contribuições de um item num eixo (já com margens). */
export interface Contribution {
  readonly min: number;
  readonly max: number;
}

export interface SizingItem {
  readonly start: number;
  readonly end: number;
  readonly contribution: Contribution;
}

interface Track {
  readonly size: TrackSize;
  base: number;
  /** Infinity = sem limite (máximo intrínseco ainda não definido, ou fr). */
  growth: number;
}

const isIntrinsic = (breadth: Breadth): boolean =>
  breadth.kind === 'auto' || breadth.kind === 'min-content' || breadth.kind === 'max-content';

const isFlexible = (track: TrackSize): boolean => track.max.kind === 'fr';

const resolveBreadth = (breadth: Breadth, available: number | undefined): number | undefined => {
  if (breadth.kind === 'fixed') return breadth.value;
  if (breadth.kind === 'percent' && available !== undefined) return (breadth.value / PERCENT_BASE) * available;
  return undefined;
};

/** §11.4: base pelo mínimo fixo (senão 0); limite pelo máximo fixo (senão infinito). */
const initTrack = (size: TrackSize, available: number | undefined): Track => {
  const min = resolveBreadth(size.min, available) ?? 0;
  const max = resolveBreadth(size.max, available);
  const growth = max === undefined ? Number.POSITIVE_INFINITY : Math.max(max, min);
  return { size, base: min, growth };
};

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const spanned = (tracks: readonly Track[], item: SizingItem): readonly Track[] => tracks.slice(item.start, item.end);

/**
 * Distribui `extra` igualmente entre os tracks (o que sobra de quem bate no teto vai aos outros).
 * `beyondCaps`: no dimensionamento intrínseco o item TEM que caber (o resto passa dos tetos,
 * §11.5.1); no maximizar, o que não cabe nos tetos continua livre.
 * Mutação local: os Track só existem dentro de sizeTracks.
 */
const distribute = (
  targets: readonly Track[],
  extra: number,
  field: 'base' | 'growth',
  cap: (track: Track) => number,
  beyondCaps: boolean = true,
): void => {
  let remaining = extra;
  let open = targets.filter((track) => cap(track) > track[field]);
  while (remaining > 1e-9 && open.length > 0) {
    const share = remaining / open.length;
    open.forEach((track) => {
      const room = cap(track) - track[field];
      const add = Math.min(share, room);
      track[field] += add;
      remaining -= add;
    });
    open = open.filter((track) => cap(track) - track[field] > 1e-9);
  }
  if (beyondCaps && remaining > 1e-9 && targets.length > 0) targets.forEach((track) => (track[field] += remaining / targets.length));
};

const finiteGrowth = (track: Track): number => (Number.isFinite(track.growth) ? track.growth : track.base);

/**
 * §11.5 resolver tamanhos intrínsecos: itens de span 1 primeiro, depois os que atravessam
 * vários tracks (em ordem de span), e por último os que atravessam tracks flexíveis (só
 * aumentam a base dos fr, pelo mínimo). Em cada caso, o mínimo intrínseco recebe a contribuição
 * mínima e o máximo intrínseco a máxima.
 */
const resolveIntrinsic = (tracks: Track[], items: readonly SizingItem[], gap: number): void => {
  const crossesFlex = (item: SizingItem): boolean => spanned(tracks, item).some((track) => isFlexible(track.size));
  const content = items.filter((item) => !crossesFlex(item));
  const bySpan = [...content].sort((a, b) => a.end - a.start - (b.end - b.start));

  bySpan.forEach((item) => {
    const targets = spanned(tracks, item);
    const gaps = gap * (targets.length - 1);
    const minTargets = targets.filter((track) => isIntrinsic(track.size.min));
    const minWanted = (track: Track): number => (track.size.min.kind === 'max-content' ? item.contribution.max : item.contribution.min);
    if (targets.length === 1 && minTargets.length === 1) {
      const [track] = minTargets;
      track!.base = Math.max(track!.base, minWanted(track!));
    } else if (minTargets.length > 0) {
      const extra = Math.max(0, item.contribution.min - sum(targets.map((t) => t.base)) - gaps);
      distribute(minTargets, extra, 'base', () => Number.POSITIVE_INFINITY);
    }
    targets.forEach((track) => {
      if (track.growth < track.base) track.growth = track.base;
    });
    const maxTargets = targets.filter((track) => isIntrinsic(track.size.max));
    const maxWanted = (track: Track): number => (track.size.max.kind === 'min-content' ? item.contribution.min : item.contribution.max);
    if (targets.length === 1 && maxTargets.length === 1) {
      const [track] = maxTargets;
      const current = Number.isFinite(track!.growth) && track!.growth > track!.base ? track!.growth : track!.base;
      track!.growth = Math.max(current, maxWanted(track!));
    } else if (maxTargets.length > 0) {
      maxTargets.forEach((track) => {
        if (!Number.isFinite(track.growth)) track.growth = track.base;
      });
      const extra = Math.max(0, item.contribution.max - sum(targets.map(finiteGrowth)) - gaps);
      distribute(maxTargets, extra, 'growth', () => Number.POSITIVE_INFINITY);
    }
  });

  // §11.5 passo 4: só fr com mínimo intrínseco (o `1fr` = minmax(auto, 1fr)); minmax(0, 1fr) ignora o conteúdo.
  items.filter(crossesFlex).forEach((item) => {
    const targets = spanned(tracks, item);
    const flex = targets.filter((track) => isFlexible(track.size) && isIntrinsic(track.size.min));
    const extra = Math.max(0, item.contribution.min - sum(targets.map((t) => t.base)) - gap * (targets.length - 1));
    distribute(flex, extra, 'base', () => Number.POSITIVE_INFINITY);
  });

  // Limite ainda infinito num máximo intrínseco sem item: fica igual à base (§11.5 passo 4).
  tracks.forEach((track) => {
    if (!isFlexible(track.size) && !Number.isFinite(track.growth)) track.growth = track.base;
    if (track.growth < track.base) track.growth = track.base;
  });
};

/** §11.6 maximizar: o espaço livre sobe as bases até o limite (só com tamanho definido). */
const maximize = (tracks: Track[], free: number): void => {
  const targets = tracks.filter((track) => !isFlexible(track.size) && track.growth > track.base);
  distribute(targets, free, 'base', (track) => track.growth, false);
};

/** §11.7.1 tamanho do fr: tracks cuja base passa do quinhão saem do rateio, iterativamente. */
const frSize = (tracks: readonly Track[], space: number): number => {
  const flex = tracks.filter((track) => isFlexible(track.size));
  let inflexible = new Set<Track>();
  for (;;) {
    const active = flex.filter((track) => !inflexible.has(track));
    const leftover = space - sum(tracks.filter((track) => !isFlexible(track.size) || inflexible.has(track)).map((t) => t.base));
    const factors = sum(active.map((track) => (track.size.max as { value: number }).value));
    const hypothetical = leftover / Math.max(1, factors);
    const tooBig = active.filter((track) => track.base > hypothetical * (track.size.max as { value: number }).value);
    if (tooBig.length === 0) return Math.max(0, hypothetical);
    inflexible = new Set([...inflexible, ...tooBig]);
  }
};

const flexOf = (track: Track): number => (track.size.max as { value: number }).value;

/** §11.7 expandir fr: com tamanho definido, rateio do espaço; sem, o maior "base / fator" dos itens. */
const expandFlexible = (tracks: Track[], items: readonly SizingItem[], available: number | undefined, gap: number): void => {
  const flex = tracks.filter((track) => isFlexible(track.size));
  if (flex.length === 0) return;
  const gaps = gap * Math.max(0, tracks.length - 1);
  const unit =
    available !== undefined
      ? frSize(tracks, available - gaps)
      : Math.max(
          0,
          ...flex.map((track) => track.base / Math.max(1, flexOf(track))),
          ...items
            .filter((item) => spanned(tracks, item).some((track) => isFlexible(track.size)))
            .map((item) => {
              const targets = spanned(tracks, item);
              const fixed = sum(targets.filter((t) => !isFlexible(t.size)).map((t) => t.base)) + gap * (targets.length - 1);
              const factors = sum(targets.filter((t) => isFlexible(t.size)).map(flexOf));
              return (item.contribution.max - fixed) / Math.max(1, factors);
            }),
        );
  flex.forEach((track) => {
    track.base = Math.max(track.base, unit * flexOf(track));
  });
};

/** §11.8 esticar tracks auto: com tamanho definido, o que sobra vai igual para os de máximo auto. */
const stretchAuto = (tracks: Track[], free: number): void => {
  const autos = tracks.filter((track) => track.size.max.kind === 'auto');
  if (free <= 0 || autos.length === 0) return;
  autos.forEach((track) => (track.base += free / autos.length));
};

/**
 * Tamanhos dos tracks de um eixo. `available` = tamanho de conteúdo definido do contêiner
 * nesse eixo (undefined = indefinido: a grade fica com o tamanho do conteúdo).
 */
export const sizeTracks = (
  sizes: readonly TrackSize[],
  items: readonly SizingItem[],
  available: number | undefined,
  gap: number,
): readonly number[] => {
  const tracks = sizes.map((size) => initTrack(size, available));
  resolveIntrinsic(tracks, items, gap);
  const gaps = gap * Math.max(0, tracks.length - 1);
  if (available !== undefined) maximize(tracks, available - gaps - sum(tracks.map((t) => t.base)));
  expandFlexible(tracks, items, available, gap);
  if (available !== undefined) stretchAuto(tracks, available - gaps - sum(tracks.map((t) => t.base)));
  return tracks.map((track) => track.base);
};

/** Tracks explícitos + implícitos (gridAutoRows/Columns em ciclo) até `count`. */
export const tracksFor = (explicit: readonly TrackSize[], auto: readonly TrackSize[], count: number): readonly TrackSize[] =>
  Array.from({ length: Math.max(count, explicit.length) }, (_, index) =>
    index < explicit.length ? explicit[index]! : auto[(index - explicit.length) % auto.length]!,
  );

/** Posições (início) de cada track a partir de 0. */
export const offsetsOf = (sizes: readonly number[], gap: number): readonly number[] =>
  sizes.reduce<readonly number[]>((offsets, _size, index) => (index === 0 ? [0] : [...offsets, offsets[index - 1]! + sizes[index - 1]! + gap]), []);

/** Retângulo de uma área (relativo à origem da área de conteúdo). */
export const areaRect = (area: Area, columns: readonly number[], rows: readonly number[], columnGap: number, rowGap: number): Rect => {
  const columnOffsets = offsetsOf(columns, columnGap);
  const rowOffsets = offsetsOf(rows, rowGap);
  const span = (sizes: readonly number[], start: number, end: number, gap: number): number =>
    sum(sizes.slice(start, end)) + gap * Math.max(0, end - start - 1);
  return {
    x: columnOffsets[area.columnStart] ?? 0,
    y: rowOffsets[area.rowStart] ?? 0,
    width: span(columns, area.columnStart, area.columnEnd, columnGap),
    height: span(rows, area.rowStart, area.rowEnd, rowGap),
  };
};

export const totalOf = (sizes: readonly number[], gap: number): number => sum(sizes) + gap * Math.max(0, sizes.length - 1);
