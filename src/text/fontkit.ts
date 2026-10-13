import type { Font } from 'fontkit';
import { DEFAULTS } from '../core/defaults.ts';
import type { Pt, TextLayout, TextMeasureInput, TextMeasurer, TextStyle } from '../core/types.ts';
import { brokenWordsOf } from './broken.ts';
import { createEstimateMeasurer } from './estimate.ts';
import { layoutLines, type MeasureWidth, widestLine } from './lines.ts';
import type { FontRegistry } from './registry.ts';

export interface FontkitMeasurerOptions {
  /** Fator sobre maxWidth na quebra; padrão DEFAULTS.textSafety. */
  readonly safety?: number;
}

/** Métricas verticais hhea em unidades da fonte (descent é negativo). */
interface VerticalMetrics {
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
}

// Teto do cache por fonte: evita crescer sem limite num processo longo (watch/CLI com muitos decks).
const MAX_CACHED_WIDTHS = 50_000;

// Largura em unidades da fonte; independe do corpo, então o loop de shrink reaproveita o cache.
const advanceUnits = (font: Font, text: string): number =>
  font.layout(text).positions.reduce((sum, position) => sum + position.xAdvance, 0);

type UnitWidth = (text: string) => number;

const cachedUnitWidth = (font: Font): UnitWidth => {
  const cache = new Map<string, number>();
  return (text) => {
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    if (cache.size >= MAX_CACHED_WIDTHS) cache.clear();
    const width = advanceUnits(font, text);
    cache.set(text, width);
    return width;
  };
};

const measureWidthOf =
  (unitWidth: UnitWidth, unitsPerEm: number, size: Pt): MeasureWidth =>
  (text) =>
    text.length === 0 ? 0 : (unitWidth(text) * size) / unitsPerEm;

const naturalLineHeight = ({ unitsPerEm, ascent, descent, lineGap }: VerticalMetrics, size: Pt): Pt =>
  ((ascent - descent + lineGap) / unitsPerEm) * size;

/**
 * Topo da linha → baseline. Escolha: escala proporcional, `ascent × multiplicador`.
 * O espaçamento "múltiplo" do PowerPoint (a:spcPct) e o do Keynote multiplicam a linha
 * inteira, inclusive a primeira, então a baseline desce na mesma proporção; o mesmo
 * critério do estimador (0.9 × size × lineHeight). O lineGap não entra no ascent: fica
 * abaixo do descent, como no PowerPoint. Ponto único de ajuste para a calibração (M3-F).
 */
export const baselineOffset = (metrics: VerticalMetrics, size: Pt, multiplier: number): Pt =>
  (metrics.ascent / metrics.unitsPerEm) * size * multiplier;

const metricsOf = (font: Font): VerticalMetrics => ({
  unitsPerEm: font.unitsPerEm,
  ascent: font.ascent,
  descent: font.descent,
  lineGap: font.lineGap,
});

/**
 * Largura da caixa que acomoda as linhas: inclui a folga do safety. Sem isso,
 * um texto dimensionado pelo conteúdo (align center/start) recebe a largura
 * exata, é remedido com largura × safety e quebra no meio da palavra.
 */
const boxWidthOf = (widest: Pt, maxWidth: Pt, safety: number): Pt => Math.min(widest / safety, maxWidth);

const measureWithFont = (
  font: Font,
  unitWidth: UnitWidth,
  input: TextMeasureInput,
  safety: number,
): TextLayout => {
  const { size, lineHeight: multiplier } = input.style;
  const metrics = metricsOf(font);
  const measureWidth = measureWidthOf(unitWidth, metrics.unitsPerEm, size);
  // Infinity × safety continua Infinity: texto sem limite nunca quebra.
  const breakWidth = input.maxWidth * safety;
  const { paragraphs, lines, truncated } = layoutLines(input.content, breakWidth, input.maxLines, measureWidth);
  const lineHeight = naturalLineHeight(metrics, size) * multiplier;
  return {
    lines,
    paragraphs,
    fontSize: size,
    lineHeight,
    ascent: baselineOffset(metrics, size, multiplier),
    width: boxWidthOf(widestLine(lines, measureWidth), input.maxWidth, safety),
    height: lines.length * lineHeight,
    wordBroken: brokenWordsOf(input.content, paragraphs).length > 0,
    truncated,
    fontMissing: false,
  };
};

const fontOf = (registry: FontRegistry, style: TextStyle): Font | undefined =>
  registry.get(style.family, style.weight, style.italic);

/** Medidor com métricas reais (fontkit). Fonte não registrada → estimativa com fontMissing. */
export const createFontkitMeasurer = (registry: FontRegistry, options: FontkitMeasurerOptions = {}): TextMeasurer => {
  const safety = options.safety ?? DEFAULTS.textSafety;
  const estimate = createEstimateMeasurer();
  // Cache por objeto Font: o layout mede o mesmo texto muitas vezes; não muda o resultado observável.
  const widthsByFont = new Map<Font, UnitWidth>();
  const unitWidthOf = (font: Font): UnitWidth => {
    const existing = widthsByFont.get(font);
    if (existing !== undefined) return existing;
    const created = cachedUnitWidth(font);
    widthsByFont.set(font, created);
    return created;
  };

  return (input) => {
    const font = fontOf(registry, input.style);
    if (font === undefined) return { ...estimate(input), fontMissing: true };
    return measureWithFont(font, unitWidthOf(font), input, safety);
  };
};
