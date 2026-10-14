import { DEFAULTS, chartColorOf, chartLabelStyleOf, chartLegendOf } from '../core/defaults.ts';
import type { ChartKind, ChartProps, PositionedChart, Pt, Rect } from '../core/types.ts';
import { type TextSvgOptions } from './svg.ts';
import { element, escapeXml, type Attrs } from './xml.ts';

/**
 * Gráfico aproximado no preview, sem biblioteca: o objetivo é reconhecer dados e
 * proporções no overview, não reproduzir pixel a pixel o motor do PowerPoint/Keynote.
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
/** Casas decimais máximas nos rótulos de valor. */
const VALUE_DECIMALS = 2;

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
}

// ───────────────────────── helpers numéricos ─────────────────────────

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const decimalsOf = (step: number): number => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

export const formatValue = (value: number, decimals = VALUE_DECIMALS): string => String(roundTo(value, decimals));

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

const ticksOf = (scale: Scale): readonly number[] => {
  const count = Math.round((scale.max - scale.min) / scale.step);
  return Array.from({ length: count + 1 }, (_, i) => roundTo(scale.min + i * scale.step, decimalsOf(scale.step)));
};

const insetOf = (rect: Rect, by: Pt): Rect => ({
  x: rect.x + by,
  y: rect.y + by,
  width: Math.max(0, rect.width - 2 * by),
  height: Math.max(0, rect.height - 2 * by),
});

const estimateWidth = (text: string, size: Pt): Pt => text.length * size * CHAR_WIDTH_EM;

// ───────────────────────── texto ─────────────────────────

const textAttrsOf = (style: LabelStyle, options: TextSvgOptions): Attrs => ({
  'font-family': options.fontFamilyMap?.[style.family] ?? style.family,
  'font-size': style.size,
  fill: style.color,
  'xml:space': 'preserve',
});

const labelSvg = (text: string, x: Pt, y: Pt, anchor: 'start' | 'middle' | 'end', base: Attrs): string =>
  element('text', { ...base, x, y, 'text-anchor': anchor }, escapeXml(text));

/** Título numa linha no topo; devolve o SVG e a altura consumida. */
const titleOf = (props: ChartProps, area: Rect, style: LabelStyle, options: TextSvgOptions) => {
  if (props.title === undefined) return { svg: '', height: 0 };
  const size = style.size + TITLE_SIZE_DELTA;
  const base = textAttrsOf({ ...style, size }, options);
  const svg = labelSvg(props.title, area.x + area.width / 2, area.y + size * LABEL_ASCENT_EM, 'middle', base);
  return { svg, height: size * LABEL_LINE_EM + style.size * LABEL_GAP_EM };
};

const legendItemsOf = (props: ChartProps): readonly LegendItem[] =>
  props.kind === 'pie'
    ? props.data.categories.map((name, i) => ({ name, color: chartColorOf(props, i) }))
    : props.data.series.map((series, i) => ({ name: series.name, color: chartColorOf(props, i) }));

/** Uma linha centrada embaixo: quadrado colorido + nome por item. */
const legendOf = (props: ChartProps, area: Rect, style: LabelStyle, options: TextSvgOptions) => {
  if (!chartLegendOf(props)) return { svg: '', height: 0 };
  const swatch = style.size * LEGEND_SWATCH_EM;
  const swatchGap = style.size * LEGEND_SWATCH_GAP_EM;
  const itemGap = style.size * LEGEND_ITEM_GAP_EM;
  const items = legendItemsOf(props);
  const widths = items.map((item) => swatch + swatchGap + estimateWidth(item.name, style.size));
  const total = widths.reduce((sum, w) => sum + w, 0) + itemGap * Math.max(0, items.length - 1);
  const lineHeight = style.size * LABEL_LINE_EM;
  const top = area.y + area.height - lineHeight;
  const baseline = top + style.size * LABEL_ASCENT_EM;
  const base = textAttrsOf(style, options);
  const starts = widths.reduce<readonly Pt[]>(
    (acc, w) => [...acc, (acc[acc.length - 1] ?? 0) + w + itemGap],
    [area.x + (area.width - total) / 2],
  );
  const svg = items
    .map((item, i) => {
      const x = starts[i] ?? area.x;
      const square = element('rect', {
        x,
        y: baseline - swatch,
        width: swatch,
        height: swatch,
        fill: item.color,
      });
      return square + labelSvg(item.name, x + swatch + swatchGap, baseline, 'start', base);
    })
    .join('');
  return { svg, height: lineHeight + style.size * LABEL_GAP_EM };
};

// ───────────────────────── bar / line ─────────────────────────

interface Axes {
  readonly plot: Rect;
  readonly scale: Scale;
  readonly yOf: (value: number) => Pt;
  readonly bandOf: (category: number) => { readonly x: Pt; readonly width: Pt };
  readonly svg: string;
}

/** Grade + rótulos do eixo de valores + rótulos de categoria; devolve a área de plotagem. */
const axesOf = (props: ChartProps, area: Rect, style: LabelStyle, options: TextSvgOptions): Axes => {
  const { categories, series } = props.data;
  const scale = niceScaleOf(series.flatMap((s) => s.values));
  const ticks = ticksOf(scale);
  const tickLabels = ticks.map((t) => formatValue(t, decimalsOf(scale.step)));
  const gap = style.size * LABEL_GAP_EM;
  const axisWidth = Math.max(...tickLabels.map((l) => estimateWidth(l, style.size))) + gap;
  const categoryHeight = style.size * LABEL_LINE_EM + gap;
  // Meia linha no topo para o rótulo do tick máximo não sair da área.
  const headroom = style.size / 2;
  const plot: Rect = {
    x: area.x + axisWidth,
    y: area.y + headroom,
    width: Math.max(0, area.width - axisWidth),
    height: Math.max(0, area.height - categoryHeight - headroom),
  };
  const yOf = (value: number): Pt =>
    plot.y + plot.height - ((value - scale.min) / (scale.max - scale.min)) * plot.height;
  const band = categories.length === 0 ? plot.width : plot.width / categories.length;
  const bandOf = (category: number) => ({ x: plot.x + category * band, width: band });
  const base = textAttrsOf(style, options);
  const grid = ticks
    .map((tick, i) => {
      const y = yOf(tick);
      const line = element('line', {
        x1: plot.x,
        y1: y,
        x2: plot.x + plot.width,
        y2: y,
        stroke: GRID.color,
        'stroke-width': GRID.width,
      });
      const label = labelSvg(tickLabels[i] ?? '', plot.x - gap, y + style.size * (LABEL_ASCENT_EM - 0.5), 'end', base);
      return line + label;
    })
    .join('');
  const zeroY = yOf(0);
  const zero = element('line', {
    x1: plot.x,
    y1: zeroY,
    x2: plot.x + plot.width,
    y2: zeroY,
    stroke: ZERO_LINE.color,
    'stroke-width': ZERO_LINE.width,
  });
  const categoryBaseline = plot.y + plot.height + gap + style.size * LABEL_ASCENT_EM;
  const categoryLabels = categories
    .map((name, i) => {
      const { x, width } = bandOf(i);
      return labelSvg(name, x + width / 2, categoryBaseline, 'middle', base);
    })
    .join('');
  return { plot, scale, yOf, bandOf, svg: grid + zero + categoryLabels };
};

/**
 * Acima do ponto (positivo) ou abaixo (negativo); embaixo não passa da área de plotagem,
 * senão colide com os rótulos de categoria.
 */
const valueLabelSvg = (value: number, x: Pt, y: Pt, axes: Axes, style: LabelStyle, base: Attrs): string => {
  const gap = style.size * LABEL_GAP_EM;
  const floor = axes.plot.y + axes.plot.height - style.size * (1 - LABEL_ASCENT_EM);
  const baseline = value >= 0 ? y - gap : Math.min(y + gap + style.size * LABEL_ASCENT_EM, floor);
  return labelSvg(formatValue(value), x, baseline, 'middle', base);
};

const barsSvg = (props: ChartProps, axes: Axes, style: LabelStyle, options: TextSvgOptions): string => {
  const { categories, series } = props.data;
  const groupRatio = 1 / (1 + DEFAULTS.chart.barGapWidthPct / 100);
  const base = textAttrsOf(style, options);
  const zeroY = axes.yOf(0);
  return categories
    .map((_, c) => {
      const band = axes.bandOf(c);
      const groupWidth = band.width * groupRatio;
      const barWidth = series.length === 0 ? 0 : groupWidth / series.length;
      const groupX = band.x + (band.width - groupWidth) / 2;
      return series
        .map((s, i) => {
          const value = s.values[c] ?? 0;
          const y = axes.yOf(value);
          const x = groupX + i * barWidth;
          const bar = element('rect', {
            x,
            y: Math.min(y, zeroY),
            width: barWidth,
            height: Math.abs(zeroY - y),
            fill: chartColorOf(props, i),
          });
          const label =
            props.showValues === true ? valueLabelSvg(value, x + barWidth / 2, y, axes, style, base) : '';
          return bar + label;
        })
        .join('');
    })
    .join('');
};

const linesSvg = (props: ChartProps, axes: Axes, style: LabelStyle, options: TextSvgOptions): string => {
  const { categories, series } = props.data;
  const base = textAttrsOf(style, options);
  const xOf = (c: number): Pt => {
    const band = axes.bandOf(c);
    return band.x + band.width / 2;
  };
  return series
    .map((s, i) => {
      const points = categories.map((_, c) => ({ x: xOf(c), y: axes.yOf(s.values[c] ?? 0), value: s.values[c] ?? 0 }));
      const line = element('polyline', {
        points: points.map((p) => `${roundTo(p.x, 3)},${roundTo(p.y, 3)}`).join(' '),
        fill: 'none',
        stroke: chartColorOf(props, i),
        'stroke-width': DEFAULTS.chart.lineSize,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      });
      const labels =
        props.showValues === true
          ? points.map((p) => valueLabelSvg(p.value, p.x, p.y, axes, style, base)).join('')
          : '';
      return line + labels;
    })
    .join('');
};

// ───────────────────────── pie ─────────────────────────

/** Ângulo 0 = 12 h, sentido horário (como o PowerPoint, firstSliceAng 0). */
const pointAt = (cx: Pt, cy: Pt, r: Pt, angle: number) => ({ x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) });

const sliceSvg = (cx: Pt, cy: Pt, r: Pt, start: number, end: number, fill: string): string => {
  const stroke: Attrs = { stroke: PIE_SEPARATOR.color, 'stroke-width': PIE_SEPARATOR.width };
  // Arco de 360° degenera no SVG (início = fim): fatia única vira círculo.
  if (end - start >= 2 * Math.PI - 1e-9) return element('circle', { cx, cy, r, fill, ...stroke });
  const a = pointAt(cx, cy, r, start);
  const b = pointAt(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  const d = `M ${roundTo(cx, 3)} ${roundTo(cy, 3)} L ${roundTo(a.x, 3)} ${roundTo(a.y, 3)} A ${roundTo(r, 3)} ${roundTo(r, 3)} 0 ${largeArc} 1 ${roundTo(b.x, 3)} ${roundTo(b.y, 3)} Z`;
  return element('path', { d, fill, ...stroke });
};

const pieSvg = (props: ChartProps, area: Rect, style: LabelStyle, options: TextSvgOptions): string => {
  // O sinal não tem significado numa fatia: usa o módulo.
  const values = (props.data.series[0]?.values ?? []).map(Math.abs);
  const total = values.reduce((sum, v) => sum + v, 0);
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const r = Math.max(0, Math.min(area.width, area.height) / 2);
  if (total <= 0 || r === 0) return element('circle', { cx, cy, r, fill: 'none', stroke: GRID.color, 'stroke-width': GRID.width });
  const base = textAttrsOf(style, options);
  const ends = values.reduce<readonly number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + (v / total) * 2 * Math.PI], [0]);
  return values
    .map((value, i) => {
      const start = ends[i] ?? 0;
      const end = ends[i + 1] ?? start;
      if (end - start <= 0) return '';
      const slice = sliceSvg(cx, cy, r, start, end, chartColorOf(props, i));
      if (props.showValues !== true) return slice;
      const mid = pointAt(cx, cy, r * PIE_LABEL_RADIUS, (start + end) / 2);
      const original = props.data.series[0]?.values[i] ?? value;
      return slice + labelSvg(formatValue(original), mid.x, mid.y + style.size * (LABEL_ASCENT_EM - 0.5), 'middle', base);
    })
    .join('');
};

// ───────────────────────── montagem ─────────────────────────

type PlotDrawer = (props: ChartProps, area: Rect, style: LabelStyle, options: TextSvgOptions) => string;

const plotDrawers: Readonly<Record<ChartKind, PlotDrawer>> = {
  bar: (props, area, style, options) => {
    const axes = axesOf(props, area, style, options);
    return axes.svg + barsSvg(props, axes, style, options);
  },
  line: (props, area, style, options) => {
    const axes = axesOf(props, area, style, options);
    return axes.svg + linesSvg(props, axes, style, options);
  },
  pie: pieSvg,
};

export const chartSvg = (node: PositionedChart, options: TextSvgOptions = {}): string => {
  const { props } = node;
  const style = chartLabelStyleOf(props);
  const area = insetOf(node.frame, style.size);
  const title = titleOf(props, area, style, options);
  const legend = legendOf(props, area, style, options);
  const plotArea: Rect = {
    x: area.x,
    y: area.y + title.height,
    width: area.width,
    height: Math.max(0, area.height - title.height - legend.height),
  };
  return element('g', {}, title.svg + plotDrawers[props.kind](props, plotArea, style, options) + legend.svg);
};
