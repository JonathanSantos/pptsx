import { DEFAULTS, chartColorOf, chartLabelStyleOf, chartLegendOf } from '../core/defaults.ts';
import {
  comboLayersOf,
  hasSecondaryAxis,
  isHorizontal,
  isRadial,
  isStacked,
  labelDecimalsOf,
  labelsOf,
  legendPositionOf,
  seriesColorOf,
} from '../emit/chart.ts';
import type { ChartAxis, ChartLegendPosition, ChartProps, PositionedChart, Pt, Rect } from '../core/types.ts';
import { type TextSvgOptions } from './svg.ts';
import { element, escapeXml, type Attrs } from './xml.ts';

/**
 * Gráfico aproximado no preview, sem biblioteca (M10-E, M14-2): o objetivo é reconhecer dados,
 * proporções e eixos no overview, não reproduzir pixel a pixel o motor do PowerPoint/Keynote.
 * Sem medidor de texto aqui: larguras de rótulo são estimadas por caractere.
 */

/** O título usa labelSize + 2, como no emit (titleFontSize). */
const TITLE_SIZE_DELTA = 2;
/** Altura de uma linha de rótulo em múltiplos do tamanho da fonte. */
const LABEL_LINE_EM = 1.25;
/** Baseline ≈ 80% do tamanho a partir do topo da linha (Arial/Liberation). */
const LABEL_ASCENT_EM = 0.8;
/** Largura média de um caractere (em em) para estimar rótulos sem medidor. */
const CHAR_WIDTH_EM = 0.55;
/** Espaço entre rótulo e o que ele descreve (eixo, barra, ponto), em em. */
const LABEL_GAP_EM = 0.4;
/** Legenda: quadrado de cor e espaços entre quadrado/nome e entre itens, em em. */
const LEGEND_SWATCH_EM = 0.75;
const LEGEND_SWATCH_GAP_EM = 0.35;
const LEGEND_ITEM_GAP_EM = 1.2;
/** Número máximo de intervalos no eixo de valores (4–5 ticks contando o zero). */
const MAX_AXIS_INTERVALS = 5;
/** Passos "bonitos" (× 10^n) do eixo de valores. */
const NICE_STEPS: readonly number[] = [1, 2, 5, 10, 20, 50];
/** Grade clara igual à do emit ({ color: 'DDDDDD', size: 0.5 }); linha do zero mais escura. */
const GRID = { color: '#DDDDDD', width: 0.5 } as const;
const ZERO_LINE = { color: '#999999', width: 0.75 } as const;
/** Fatias com borda branca fina para separar cores vizinhas parecidas. */
const PIE_SEPARATOR = { color: '#FFFFFF', width: 0.75 } as const;
/** Rótulo de valor da fatia: a esta fração do raio, a partir do centro. */
const PIE_LABEL_RADIUS = 0.62;
const PERCENT = 100;

interface LabelStyle {
  readonly family: string;
  readonly size: Pt;
  readonly color: string;
}

interface Scale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

interface LegendItem {
  readonly name: string;
  readonly color: string;
  /** Linha (combo/line) ou bloco. */
  readonly line?: boolean;
}

// ───────────────────────── helpers numéricos ─────────────────────────

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const decimalsOf = (step: number): number => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

/** Opções do chartSvg: as do texto + o idioma dos números (separador decimal, como no PPTX). */
export interface ChartSvgOptions extends TextSvgOptions {
  /** Padrão DEFAULTS.lang. */
  readonly lang?: string;
}

/**
 * Número como o PPTX mostra: `fixed` casas (rótulos de valor, formato '0.0' do emissor) ou
 * até `decimals` casas (eixo, formato 'General'), no separador decimal do idioma e sem
 * separador de milhar (nenhum dos dois formatos agrupa).
 */
export const formatValue = (value: number, decimals: number, lang: string = DEFAULTS.lang, fixed = false): string =>
  new Intl.NumberFormat(lang, {
    minimumFractionDigits: fixed ? decimals : 0,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(value);

/** Formato simples do Excel no preview: '0%' / '0.0%' (×100 com %), '0.00' (casas fixas); o resto como 'General'. */
const formatWith = (value: number, format: string | undefined, fallbackDecimals: number, lang: string | undefined, fixed: boolean): string => {
  if (format === undefined || format === 'General') return formatValue(value, fallbackDecimals, lang, fixed);
  const decimals = (/\.(0+)/.exec(format)?.[1] ?? '').length;
  if (format.includes('%')) return `${formatValue(value * PERCENT, decimals, lang, true)}%`;
  return formatValue(value, decimals, lang, true);
};

const intervalsOf = (min: number, max: number, step: number): number =>
  Math.ceil(max / step - 1e-9) - Math.floor(min / step + 1e-9);

/**
 * Eixo de 0 (ou do mínimo negativo) ao máximo "bonito": o menor passo 1/2/5 × 10^n que
 * cobre os dados em até MAX_AXIS_INTERVALS intervalos.
 */
export const niceScaleOf = (values: readonly number[]): Scale => {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const range = hi - lo > 0 ? hi - lo : 1;
  const magnitude = 10 ** Math.floor(Math.log10(range / MAX_AXIS_INTERVALS));
  const step =
    NICE_STEPS.map((m) => m * magnitude).find((s) => intervalsOf(lo, hi, s) <= MAX_AXIS_INTERVALS) ?? range;
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = hi - lo > 0 ? Math.ceil(hi / step - 1e-9) * step : step;
  return { min: roundTo(min, decimalsOf(step)), max: roundTo(max, decimalsOf(step)), step };
};

/** Escala dos dados com o min/max/step do autor por cima. */
const scaleOf = (values: readonly number[], axis: ChartAxis | undefined, fixed?: Scale): Scale => {
  const base = fixed ?? niceScaleOf(values);
  const min = axis?.min ?? base.min;
  const max = axis?.max ?? base.max;
  const step = axis?.step ?? (axis?.min !== undefined || axis?.max !== undefined ? niceScaleOf([min, max]).step : base.step);
  return { min, max: max > min ? max : min + step, step };
};

const ticksOf = (scale: Scale): readonly number[] => {
  const count = Math.max(1, Math.round((scale.max - scale.min) / scale.step));
  return Array.from({ length: count + 1 }, (_, i) => roundTo(scale.min + i * scale.step, Math.max(decimalsOf(scale.step), 6)));
};

const insetOf = (rect: Rect, by: Pt): Rect => ({
  x: rect.x + by,
  y: rect.y + by,
  width: Math.max(0, rect.width - 2 * by),
  height: Math.max(0, rect.height - 2 * by),
});

const estimateWidth = (text: string, size: Pt): Pt => text.length * size * CHAR_WIDTH_EM;

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

// ───────────────────────── texto ─────────────────────────

const textAttrsOf = (style: LabelStyle, options: ChartSvgOptions): Attrs => ({
  'font-family': options.fontFamilyMap?.[style.family] ?? style.family,
  'font-size': style.size,
  fill: style.color,
  'xml:space': 'preserve',
});

const labelSvg = (text: string, x: Pt, y: Pt, anchor: 'start' | 'middle' | 'end', base: Attrs, extra: Attrs = {}): string =>
  element('text', { ...base, x, y, 'text-anchor': anchor, ...extra }, escapeXml(text));

/** Título numa linha no topo; devolve o SVG e a altura consumida. */
const titleOf = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions) => {
  if (props.title === undefined) return { svg: '', height: 0 };
  const size = style.size + TITLE_SIZE_DELTA;
  const base = textAttrsOf({ ...style, size }, options);
  const svg = labelSvg(props.title, area.x + area.width / 2, area.y + size * LABEL_ASCENT_EM, 'middle', base);
  return { svg, height: size * LABEL_LINE_EM + style.size * LABEL_GAP_EM };
};

const legendItemsOf = (props: ChartProps): readonly LegendItem[] => {
  if (isRadial(props.kind)) return (props.data.categories ?? []).map((name, i) => ({ name, color: chartColorOf(props, i) }));
  return props.data.series.map((series, i) => ({
    name: series.name,
    color: seriesColorOf(props, i),
    line: props.kind === 'line' || series.as === 'line',
  }));
};

interface Placed {
  readonly svg: string;
  /** Área que sobra para o gráfico. */
  readonly rest: Rect;
}

const swatchSvg = (item: LegendItem, x: Pt, baseline: Pt, size: Pt): string => {
  if (item.line !== true) return element('rect', { x, y: baseline - size, width: size, height: size, fill: item.color });
  const y = baseline - size / 2;
  return element('line', { x1: x, y1: y, x2: x + size, y2: y, stroke: item.color, 'stroke-width': DEFAULTS.chart.lineSize });
};

/** Legenda numa linha (topo/base) ou numa coluna (esquerda/direita), como o legendPos do emissor. */
const legendOf = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions): Placed => {
  if (!chartLegendOf(props)) return { svg: '', rest: area };
  const position: ChartLegendPosition = legendPositionOf(props);
  const swatch = style.size * LEGEND_SWATCH_EM;
  const swatchGap = style.size * LEGEND_SWATCH_GAP_EM;
  const itemGap = style.size * LEGEND_ITEM_GAP_EM;
  const lineHeight = style.size * LABEL_LINE_EM;
  const gap = style.size * LABEL_GAP_EM;
  const items = legendItemsOf(props);
  const base = textAttrsOf(style, options);
  const widths = items.map((item) => swatch + swatchGap + estimateWidth(item.name, style.size));
  const itemSvg = (item: LegendItem, x: Pt, baseline: Pt) => swatchSvg(item, x, baseline, swatch) + labelSvg(item.name, x + swatch + swatchGap, baseline, 'start', base);
  if (position === 'left' || position === 'right') {
    const width = Math.max(...widths) + gap;
    const top = area.y + (area.height - items.length * lineHeight) / 2;
    const x = position === 'right' ? area.x + area.width - width + gap : area.x;
    const svg = items.map((item, i) => itemSvg(item, x, top + i * lineHeight + style.size * LABEL_ASCENT_EM)).join('');
    const rest = position === 'right' ? { ...area, width: Math.max(0, area.width - width) } : { ...area, x: area.x + width, width: Math.max(0, area.width - width) };
    return { svg, rest };
  }
  const total = sum(widths) + itemGap * Math.max(0, items.length - 1);
  const top = position === 'top' ? area.y : area.y + area.height - lineHeight;
  const baseline = top + style.size * LABEL_ASCENT_EM;
  const starts = widths.reduce<readonly Pt[]>((acc, w) => [...acc, (acc[acc.length - 1] ?? 0) + w + itemGap], [area.x + (area.width - total) / 2]);
  const svg = items.map((item, i) => itemSvg(item, starts[i] ?? area.x, baseline)).join('');
  const used = lineHeight + gap;
  const rest = position === 'top' ? { ...area, y: area.y + used, height: Math.max(0, area.height - used) } : { ...area, height: Math.max(0, area.height - used) };
  return { svg, rest };
};

// ───────────────────────── eixos ─────────────────────────

/** Valores que o eixo precisa cobrir: empilhado soma por categoria (positivos e negativos à parte). */
const rangeValuesOf = (props: ChartProps, indexes: readonly number[]): readonly number[] => {
  const series = indexes.map((index) => props.data.series[index]!);
  if (!isStacked(props.kind)) return series.flatMap((s) => s.values ?? []);
  const categories = (props.data.categories ?? []).length;
  return Array.from({ length: categories }, (_, c) => {
    const values = series.map((s) => s.values?.[c] ?? 0);
    return [sum(values.filter((v) => v > 0)), sum(values.filter((v) => v < 0))];
  }).flat();
};

interface ValueAxis {
  readonly scale: Scale;
  readonly format?: string;
  readonly percent: boolean;
}

interface Axes {
  readonly plot: Rect;
  /** Posição (y no vertical, x no horizontal) de um valor no eixo principal / secundário. */
  readonly at: (value: number, secondary?: boolean) => Pt;
  readonly bandOf: (category: number) => { readonly start: Pt; readonly size: Pt };
  readonly horizontal: boolean;
  readonly svg: string;
}

const tickLabelsOf = (axis: ValueAxis, lang: string | undefined): readonly string[] =>
  ticksOf(axis.scale).map((tick) => (axis.percent ? `${formatValue(tick * PERCENT, Math.max(0, decimalsOf(axis.scale.step * PERCENT)), lang)}%` : formatWith(tick, axis.format, decimalsOf(axis.scale.step), lang, false)));

const axisTitleSvg = (title: string | undefined, x: Pt, y: Pt, rotate: boolean, base: Attrs): string =>
  title === undefined ? '' : labelSvg(title, x, y, 'middle', base, rotate ? { transform: `rotate(-90 ${roundTo(x, 3)} ${roundTo(y, 3)})` } : {});

const gridLineSvg = (x1: Pt, y1: Pt, x2: Pt, y2: Pt, zero = false): string =>
  element('line', { x1, y1, x2, y2, stroke: zero ? ZERO_LINE.color : GRID.color, 'stroke-width': zero ? ZERO_LINE.width : GRID.width });

/**
 * Grade + rótulos do eixo de valores (e do secundário, no combo) + categorias. Vertical: valores
 * à esquerda, categorias embaixo; horizontal (barH): categorias à esquerda (a 1ª embaixo, como o
 * PowerPoint), valores embaixo.
 */
const axesOf = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions, primary: ValueAxis, secondary?: ValueAxis): Axes => {
  const horizontal = isHorizontal(props.kind);
  const categories = props.data.categories ?? [];
  const gap = style.size * LABEL_GAP_EM;
  const lineHeight = style.size * LABEL_LINE_EM;
  const base = textAttrsOf(style, options);
  const xAxis = props.xAxis;
  const yAxis = props.yAxis;
  const primaryLabels = yAxis?.hidden === true ? [] : tickLabelsOf(primary, options.lang);
  const secondaryLabels = secondary === undefined || props.y2Axis?.hidden === true ? [] : tickLabelsOf(secondary, options.lang);
  const categoryLabels = xAxis?.hidden === true ? [] : categories;
  const valueTitle = yAxis?.title === undefined ? 0 : lineHeight;
  const categoryTitle = xAxis?.title === undefined ? 0 : lineHeight;
  const valueLabelWidth = Math.max(0, ...primaryLabels.map((l) => estimateWidth(l, style.size))) + gap;
  const secondaryWidth = secondaryLabels.length === 0 ? 0 : Math.max(0, ...secondaryLabels.map((l) => estimateWidth(l, style.size))) + gap + (props.y2Axis?.title === undefined ? 0 : lineHeight);
  const categoryLabelWidth = Math.max(0, ...categoryLabels.map((l) => estimateWidth(l, style.size))) + gap;
  const headroom = style.size / 2;
  const left = horizontal ? categoryLabelWidth + categoryTitle : valueLabelWidth + valueTitle;
  const bottom = horizontal ? (primaryLabels.length === 0 ? 0 : lineHeight + gap) + valueTitle : (categoryLabels.length === 0 ? 0 : lineHeight + gap) + categoryTitle;
  const plot: Rect = {
    x: area.x + left,
    y: area.y + headroom,
    width: Math.max(0, area.width - left - secondaryWidth - (horizontal ? estimateWidth(primaryLabels.at(-1) ?? '', style.size) / 2 : 0)),
    height: Math.max(0, area.height - bottom - headroom),
  };
  const fraction = (scale: Scale, value: number) => (value - scale.min) / (scale.max - scale.min);
  const at = (value: number, useSecondary = false): Pt => {
    const scale = useSecondary && secondary !== undefined ? secondary.scale : primary.scale;
    return horizontal ? plot.x + fraction(scale, value) * plot.width : plot.y + plot.height - fraction(scale, value) * plot.height;
  };
  const length = horizontal ? plot.height : plot.width;
  const band = categories.length === 0 ? length : length / categories.length;
  // Horizontal: a 1ª categoria embaixo (o PowerPoint desenha o eixo de categorias de baixo para cima).
  const bandOf = (category: number) =>
    horizontal ? { start: plot.y + plot.height - (category + 1) * band, size: band } : { start: plot.x + category * band, size: band };
  const ticks = ticksOf(primary.scale);
  const grid = yAxis?.grid === false ? '' : ticks.map((tick) => {
    const p = at(tick);
    return horizontal ? gridLineSvg(p, plot.y, p, plot.y + plot.height, tick === 0) : gridLineSvg(plot.x, p, plot.x + plot.width, p, tick === 0);
  }).join('');
  const valueLabels = primaryLabels.map((label, i) => {
    const p = at(ticks[i] ?? 0);
    return horizontal
      ? labelSvg(label, p, plot.y + plot.height + gap + style.size * LABEL_ASCENT_EM, 'middle', base)
      : labelSvg(label, plot.x - gap, p + style.size * (LABEL_ASCENT_EM - 0.5), 'end', base);
  }).join('');
  const secondaryTicks = secondary === undefined ? [] : ticksOf(secondary.scale);
  const secondarySvg = secondaryLabels.map((label, i) => labelSvg(label, plot.x + plot.width + gap, at(secondaryTicks[i] ?? 0, true) + style.size * (LABEL_ASCENT_EM - 0.5), 'start', base)).join('');
  const categorySvg = categoryLabels.map((name, i) => {
    const { start, size } = bandOf(i);
    return horizontal
      ? labelSvg(name, plot.x - gap, start + size / 2 + style.size * (LABEL_ASCENT_EM - 0.5), 'end', base)
      : labelSvg(name, start + size / 2, plot.y + plot.height + gap + style.size * LABEL_ASCENT_EM, 'middle', base);
  }).join('');
  const valueTitleSvg = horizontal
    ? axisTitleSvg(yAxis?.title, plot.x + plot.width / 2, area.y + area.height - style.size * (1 - LABEL_ASCENT_EM), false, base)
    : axisTitleSvg(yAxis?.title, area.x + style.size * LABEL_ASCENT_EM, plot.y + plot.height / 2, true, base);
  const categoryTitleSvg = horizontal
    ? axisTitleSvg(xAxis?.title, area.x + style.size * LABEL_ASCENT_EM, plot.y + plot.height / 2, true, base)
    : axisTitleSvg(xAxis?.title, plot.x + plot.width / 2, area.y + area.height - style.size * (1 - LABEL_ASCENT_EM), false, base);
  const secondaryTitle = axisTitleSvg(props.y2Axis?.title, area.x + area.width - style.size * (1 - LABEL_ASCENT_EM), plot.y + plot.height / 2, true, base);
  return { plot, at, bandOf, horizontal, svg: grid + valueLabels + secondarySvg + categorySvg + valueTitleSvg + categoryTitleSvg + secondaryTitle };
};

// ───────────────────────── rótulos de valor ─────────────────────────

const valueTextOf = (props: ChartProps, value: number, options: ChartSvgOptions): string =>
  formatWith(value, labelsOf(props).format, labelDecimalsOf(props), options.lang, true);

/** Fora (acima/à direita) por padrão; no centro do segmento em empilhados e com position 'center'. */
const barLabelSvg = (props: ChartProps, value: number, from: Pt, to: Pt, cross: Pt, axes: Axes, style: LabelStyle, base: Attrs, options: ChartSvgOptions): string => {
  const labels = labelsOf(props);
  if (!labels.show) return '';
  const text = valueTextOf(props, value, options);
  const gap = style.size * LABEL_GAP_EM;
  const centered = isStacked(props.kind) || labels.position === 'center';
  const inside = labels.position === 'inside';
  if (axes.horizontal) {
    const y = cross + style.size * (LABEL_ASCENT_EM - 0.5);
    if (centered) return labelSvg(text, (from + to) / 2, y, 'middle', base);
    return inside ? labelSvg(text, to - gap, y, 'end', base) : labelSvg(text, to + gap, y, 'start', base);
  }
  if (centered) return labelSvg(text, cross, (from + to) / 2 + style.size * (LABEL_ASCENT_EM - 0.5), 'middle', base);
  const up = to <= from;
  if (inside) return labelSvg(text, cross, up ? to + gap + style.size * LABEL_ASCENT_EM : to - gap, 'middle', base);
  return labelSvg(text, cross, up ? to - gap : to + gap + style.size * LABEL_ASCENT_EM, 'middle', base);
};

// ───────────────────────── barras ─────────────────────────

const barRect = (horizontal: boolean, from: Pt, to: Pt, start: Pt, size: Pt, fill: string): string =>
  horizontal
    ? element('rect', { x: Math.min(from, to), y: start, width: Math.abs(to - from), height: size, fill })
    : element('rect', { x: start, y: Math.min(from, to), width: size, height: Math.abs(to - from), fill });

/** Barras agrupadas, empilhadas ou 100 %, verticais ou horizontais, das séries `indexes`. */
const barsSvg = (props: ChartProps, axes: Axes, indexes: readonly number[], style: LabelStyle, options: ChartSvgOptions, secondary = false): string => {
  const categories = props.data.categories ?? [];
  const groupRatio = 1 / (1 + DEFAULTS.chart.barGapWidthPct / PERCENT);
  const base = textAttrsOf(style, options);
  const stacked = isStacked(props.kind);
  const percent = props.kind === 'stackedBar100';
  return categories
    .map((_, c) => {
      const band = axes.bandOf(c);
      const group = band.size * groupRatio;
      const groupStart = band.start + (band.size - group) / 2;
      const values = indexes.map((index) => props.data.series[index]?.values?.[c] ?? 0);
      const total = sum(values.map(Math.abs)) || 1;
      let positive = 0;
      let negative = 0;
      return indexes
        .map((index, i) => {
          const raw = values[i] ?? 0;
          const value = percent ? Math.abs(raw) / total : raw;
          const offset = value >= 0 ? positive : negative;
          if (stacked) {
            if (value >= 0) positive += value;
            else negative += value;
          }
          const from = axes.at(stacked ? offset : 0, secondary);
          const to = axes.at(stacked ? offset + value : value, secondary);
          const size = stacked ? group : group / indexes.length;
          const start = stacked ? groupStart : axes.horizontal ? groupStart + (indexes.length - 1 - i) * size : groupStart + i * size;
          const cross = start + size / 2;
          return barRect(axes.horizontal, from, to, start, size, seriesColorOf(props, index)) + barLabelSvg(props, raw, from, to, cross, axes, style, base, options);
        })
        .join('');
    })
    .join('');
};

// ───────────────────────── linhas, áreas e pontos ─────────────────────────

interface Point {
  readonly x: Pt;
  readonly y: Pt;
}

const pointsAttr = (points: readonly Point[]): string => points.map((p) => `${roundTo(p.x, 3)},${roundTo(p.y, 3)}`).join(' ');

/** Curva por Catmull-Rom (o lineSmooth do PPTX é uma spline; aqui só precisa parecer suave). */
const smoothPath = (points: readonly Point[]): string => {
  if (points.length < 3) return `M ${pointsAttr(points).replace(/ /g, ' L ')}`;
  const d = points.slice(1).map((p, i) => {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p3 = points[i + 2] ?? p;
    const c1 = { x: p1.x + (p.x - p0.x) / 6, y: p1.y + (p.y - p0.y) / 6 };
    const c2 = { x: p.x - (p3.x - p1.x) / 6, y: p.y - (p3.y - p1.y) / 6 };
    return `C ${roundTo(c1.x, 3)} ${roundTo(c1.y, 3)} ${roundTo(c2.x, 3)} ${roundTo(c2.y, 3)} ${roundTo(p.x, 3)} ${roundTo(p.y, 3)}`;
  });
  return `M ${roundTo(points[0]!.x, 3)} ${roundTo(points[0]!.y, 3)} ${d.join(' ')}`;
};

const markerSvg = (p: Point, color: string): string => element('circle', { cx: roundTo(p.x, 3), cy: roundTo(p.y, 3), r: DEFAULTS.chart.markerSize / 2, fill: color });

const pointLabelSvg = (text: string, p: Point, style: LabelStyle, base: Attrs): string =>
  labelSvg(text, p.x, p.y - style.size * LABEL_GAP_EM, 'middle', base);

const linesSvg = (props: ChartProps, axes: Axes, indexes: readonly number[], style: LabelStyle, options: ChartSvgOptions, secondary = false): string => {
  const categories = props.data.categories ?? [];
  const base = textAttrsOf(style, options);
  const markers = props.markers === true;
  return indexes
    .map((index) => {
      const series = props.data.series[index]!;
      const color = seriesColorOf(props, index);
      const points = categories.map((_, c) => {
        const band = axes.bandOf(c);
        return { x: band.start + band.size / 2, y: axes.at(series.values?.[c] ?? 0, secondary) };
      });
      const stroke: Attrs = { fill: 'none', stroke: color, 'stroke-width': DEFAULTS.chart.lineSize, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      const line = props.smooth === true ? element('path', { d: smoothPath(points), ...stroke }) : element('polyline', { points: pointsAttr(points), ...stroke });
      const dots = markers ? points.map((p) => markerSvg(p, color)).join('') : '';
      const labels = labelsOf(props).show ? points.map((p, c) => pointLabelSvg(valueTextOf(props, series.values?.[c] ?? 0, options), p, style, base)).join('') : '';
      return line + dots + labels;
    })
    .join('');
};

/** Área até o zero (sobreposta) ou empilhada (cada série sobre a soma das anteriores). */
const areasSvg = (props: ChartProps, axes: Axes, style: LabelStyle, options: ChartSvgOptions): string => {
  const categories = props.data.categories ?? [];
  const stacked = props.kind === 'stackedArea';
  const xs = categories.map((_, c) => {
    const band = axes.bandOf(c);
    return band.start + band.size / 2;
  });
  const base = textAttrsOf(style, options);
  let floor = categories.map(() => 0);
  return props.data.series
    .map((series, index) => {
      const values = categories.map((_, c) => series.values?.[c] ?? 0);
      const bottom = stacked ? floor : categories.map(() => 0);
      const top = values.map((value, c) => (bottom[c] ?? 0) + value);
      floor = stacked ? top : floor;
      const upper = xs.map((x, c) => ({ x, y: axes.at(top[c] ?? 0) }));
      const lower = xs.map((x, c) => ({ x, y: axes.at(bottom[c] ?? 0) })).reverse();
      const shape = element('polygon', { points: pointsAttr([...upper, ...lower]), fill: seriesColorOf(props, index), 'fill-opacity': DEFAULTS.chart.areaOpacity });
      const labels = labelsOf(props).show ? upper.map((p, c) => pointLabelSvg(valueTextOf(props, values[c] ?? 0, options), p, style, base)).join('') : '';
      return shape + labels;
    })
    .join('');
};

// ───────────────────────── scatter ─────────────────────────

const scatterSvg = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions): string => {
  const points = props.data.series.flatMap((series) => series.points ?? []);
  const xScale = scaleOf(points.map(([x]) => x), props.xAxis);
  const yScale = scaleOf(points.map(([, y]) => y), props.yAxis);
  const gap = style.size * LABEL_GAP_EM;
  const lineHeight = style.size * LABEL_LINE_EM;
  const base = textAttrsOf(style, options);
  const yLabels = tickLabelsOf({ scale: yScale, format: props.yAxis?.format, percent: false }, options.lang);
  const xLabels = tickLabelsOf({ scale: xScale, format: props.xAxis?.format, percent: false }, options.lang);
  const left = Math.max(0, ...yLabels.map((l) => estimateWidth(l, style.size))) + gap + (props.yAxis?.title === undefined ? 0 : lineHeight);
  const bottom = lineHeight + gap + (props.xAxis?.title === undefined ? 0 : lineHeight);
  const plot: Rect = { x: area.x + left, y: area.y + style.size / 2, width: Math.max(0, area.width - left - estimateWidth(xLabels.at(-1) ?? '', style.size) / 2), height: Math.max(0, area.height - bottom - style.size / 2) };
  const xOf = (x: number) => plot.x + ((x - xScale.min) / (xScale.max - xScale.min)) * plot.width;
  const yOf = (y: number) => plot.y + plot.height - ((y - yScale.min) / (yScale.max - yScale.min)) * plot.height;
  const yTicks = ticksOf(yScale);
  const xTicks = ticksOf(xScale);
  const grid = yTicks.map((t, i) => gridLineSvg(plot.x, yOf(t), plot.x + plot.width, yOf(t)) + labelSvg(yLabels[i] ?? '', plot.x - gap, yOf(t) + style.size * (LABEL_ASCENT_EM - 0.5), 'end', base)).join('');
  const xs = xTicks.map((t, i) => labelSvg(xLabels[i] ?? '', xOf(t), plot.y + plot.height + gap + style.size * LABEL_ASCENT_EM, 'middle', base)).join('');
  const titles =
    axisTitleSvg(props.yAxis?.title, area.x + style.size * LABEL_ASCENT_EM, plot.y + plot.height / 2, true, base) +
    axisTitleSvg(props.xAxis?.title, plot.x + plot.width / 2, area.y + area.height - style.size * (1 - LABEL_ASCENT_EM), false, base);
  const dots = props.data.series
    .map((series, index) => (series.points ?? []).map(([x, y]) => markerSvg({ x: xOf(x), y: yOf(y) }, seriesColorOf(props, index))).join(''))
    .join('');
  return grid + xs + titles + dots;
};

// ───────────────────────── pizza e rosca ─────────────────────────

/** Ângulo 0 = 12 h, sentido horário (como o PowerPoint, firstSliceAng 0). */
const pointAt = (cx: Pt, cy: Pt, r: Pt, angle: number) => ({ x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) });

const sliceSvg = (cx: Pt, cy: Pt, r: Pt, inner: Pt, start: number, end: number, fill: string): string => {
  const stroke: Attrs = { stroke: PIE_SEPARATOR.color, 'stroke-width': PIE_SEPARATOR.width };
  const full = end - start >= 2 * Math.PI - 1e-9;
  if (full && inner <= 0) return element('circle', { cx, cy, r, fill, ...stroke });
  if (full) return element('circle', { cx, cy, r: (r + inner) / 2, fill: 'none', stroke: fill, 'stroke-width': r - inner });
  const a = pointAt(cx, cy, r, start);
  const b = pointAt(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  const f = (v: number) => roundTo(v, 3);
  if (inner <= 0) {
    return element('path', { d: `M ${f(cx)} ${f(cy)} L ${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r)} 0 ${largeArc} 1 ${f(b.x)} ${f(b.y)} Z`, fill, ...stroke });
  }
  const c = pointAt(cx, cy, inner, end);
  const d = pointAt(cx, cy, inner, start);
  return element('path', {
    d: `M ${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r)} 0 ${largeArc} 1 ${f(b.x)} ${f(b.y)} L ${f(c.x)} ${f(c.y)} A ${f(inner)} ${f(inner)} 0 ${largeArc} 0 ${f(d.x)} ${f(d.y)} Z`,
    fill,
    ...stroke,
  });
};

const radialSvg = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions): string => {
  // O sinal não tem significado numa fatia: usa o módulo.
  const values = (props.data.series[0]?.values ?? []).map((value) => Math.abs(value));
  const total = sum(values);
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const r = Math.max(0, Math.min(area.width, area.height) / 2);
  const inner = props.kind === 'doughnut' ? (r * (props.holeSize ?? DEFAULTS.chart.holeSize)) / PERCENT : 0;
  if (total <= 0 || r === 0) return element('circle', { cx, cy, r, fill: 'none', stroke: GRID.color, 'stroke-width': GRID.width });
  const base = textAttrsOf(style, options);
  const ends = values.reduce<readonly number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + (v / total) * 2 * Math.PI], [0]);
  const labelRadius = inner > 0 ? (r + inner) / 2 : r * PIE_LABEL_RADIUS;
  return values
    .map((value, i) => {
      const start = ends[i] ?? 0;
      const end = ends[i + 1] ?? start;
      if (end - start <= 0) return '';
      const slice = sliceSvg(cx, cy, r, inner, start, end, chartColorOf(props, i));
      if (!labelsOf(props).show) return slice;
      const mid = pointAt(cx, cy, labelRadius, (start + end) / 2);
      const original = props.data.series[0]?.values?.[i] ?? value;
      return slice + labelSvg(valueTextOf(props, original, options), mid.x, mid.y + style.size * (LABEL_ASCENT_EM - 0.5), 'middle', base);
    })
    .join('');
};

// ───────────────────────── montagem ─────────────────────────

const allIndexes = (props: ChartProps): readonly number[] => props.data.series.map((_, index) => index);

const valueAxisOf = (props: ChartProps, indexes: readonly number[], axis: ChartAxis | undefined): ValueAxis => {
  if (props.kind === 'stackedBar100') return { scale: scaleOf([], axis, { min: 0, max: 1, step: 0.25 }), percent: true };
  return { scale: scaleOf(rangeValuesOf(props, indexes), axis), format: axis?.format, percent: false };
};

const cartesianSvg = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions): string => {
  const indexes = allIndexes(props);
  const axes = axesOf(props, area, style, options, valueAxisOf(props, indexes, props.yAxis));
  if (props.kind === 'line') return axes.svg + linesSvg(props, axes, indexes, style, options);
  if (props.kind === 'area' || props.kind === 'stackedArea') return axes.svg + areasSvg(props, axes, style, options);
  return axes.svg + barsSvg(props, axes, indexes, style, options);
};

const comboSvg = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions): string => {
  const layers = comboLayersOf(props);
  const primary = layers.filter((layer) => !layer.secondary).flatMap((layer) => layer.indexes);
  const secondary = layers.filter((layer) => layer.secondary).flatMap((layer) => layer.indexes);
  const axes = axesOf(
    props,
    area,
    style,
    options,
    valueAxisOf(props, primary.length > 0 ? primary : secondary, props.yAxis),
    hasSecondaryAxis(props) ? valueAxisOf(props, secondary, props.y2Axis) : undefined,
  );
  // Barras primeiro (todas as barras dividem a banda), linhas por cima.
  const bars = layers.filter((layer) => layer.as === 'bar').flatMap((layer) => layer.indexes);
  const barSvg = bars.length === 0 ? '' : barsSvg(props, axes, bars, style, options, false);
  const lineSvg = layers
    .filter((layer) => layer.as === 'line')
    .map((layer) => linesSvg(props, axes, layer.indexes, style, options, layer.secondary))
    .join('');
  return axes.svg + barSvg + lineSvg;
};

const plotOf = (props: ChartProps, area: Rect, style: LabelStyle, options: ChartSvgOptions): string => {
  if (isRadial(props.kind)) return radialSvg(props, area, style, options);
  if (props.kind === 'scatter') return scatterSvg(props, area, style, options);
  if (props.kind === 'combo') return comboSvg(props, area, style, options);
  return cartesianSvg(props, area, style, options);
};

export const chartSvg = (node: PositionedChart, options: ChartSvgOptions = {}): string => {
  const { props } = node;
  const style = chartLabelStyleOf(props);
  const area = insetOf(node.frame, style.size);
  const title = titleOf(props, area, style, options);
  const afterTitle: Rect = { ...area, y: area.y + title.height, height: Math.max(0, area.height - title.height) };
  const legend = legendOf(props, afterTitle, style, options);
  return element('g', {}, title.svg + plotOf(props, legend.rest, style, options) + legend.svg);
};
