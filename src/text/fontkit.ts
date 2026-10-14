import type { Font } from 'fontkit';
import { DEFAULTS } from '../core/defaults.ts';
import type { Pt, TextLayout, TextMeasureInput, TextMeasurer } from '../core/types.ts';
import { brokenWordsOf } from './broken.ts';
import { createEstimateMeasurer } from './estimate.ts';
import { layoutText } from './lines.ts';
import type { MeasureRun } from './pieces.ts';
import type { FontRegistry } from './registry.ts';
import { runsOfInput } from './source.ts';

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

// NBSP é medido como espaço (CONTRACTS M8): algumas fontes nem têm o glifo, e o renderizador o desenha como espaço.
const NBSP = /\u00A0/g;

const measureWidthOf =
  (unitWidth: UnitWidth, unitsPerEm: number, size: Pt): ((text: string) => Pt) =>
  (text) =>
    text.length === 0 ? 0 : (unitWidth(text.replace(NBSP, ' ')) * size) / unitsPerEm;

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
 * Com nowrap não há limite: a largura pode passar de maxWidth (o fit acusa o estouro).
 */
const boxWidthOf = (widest: Pt, maxWidth: Pt, safety: number, nowrap: boolean): Pt =>
  nowrap ? widest / safety : Math.min(widest / safety, maxWidth);

const measureWithFonts = (
  metricsFont: Font,
  measure: MeasureRun,
  input: TextMeasureInput,
  safety: number,
): TextLayout => {
  const { size, lineHeight: multiplier } = input.style;
  const metrics = metricsOf(metricsFont);
  const nowrap = input.nowrap === true;
  // Infinity × safety continua Infinity: texto sem limite nunca quebra.
  const laid = layoutText(input, input.maxWidth * safety, measure);
  const lineHeight = naturalLineHeight(metrics, size) * multiplier;
  return {
    lines: laid.lines,
    paragraphs: laid.paragraphs,
    lineRuns: laid.lineRuns,
    fontSize: size,
    lineHeight,
    ascent: baselineOffset(metrics, size, multiplier),
    width: boxWidthOf(laid.widestLine, input.maxWidth, safety, nowrap),
    height: laid.lines.length * lineHeight,
    widestSegment: laid.widestSegment,
    wordBroken: !nowrap && brokenWordsOf(input.content, laid.paragraphs).length > 0,
    truncated: laid.truncated,
    fontMissing: false,
  };
};

/** Medidor com métricas reais (fontkit). Alguma face dos runs não registrada → estimativa com fontMissing. */
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
    const { family, size, weight, italic } = input.style;
    const found = runsOfInput(input).map((run) => registry.get(family, run.weight, run.italic));
    const fonts = found.filter((font): font is Font => font !== undefined);
    if (fonts.length !== found.length) return { ...estimate(input), fontMissing: true };
    const [firstFont] = fonts;
    // A altura da linha é única e vem da face do estilo; se só as faces dos runs existem
    // (ex.: <Text font="X"><B>…</B></Text> com X só em bold), usa-se a do primeiro run.
    const metricsFont = registry.get(family, weight, italic) ?? firstFont;
    if (metricsFont === undefined) return { ...estimate(input), fontMissing: true };
    const widths = fonts.map((font) => measureWidthOf(unitWidthOf(font), font.unitsPerEm, size));
    const measure: MeasureRun = (text, run) => widths[run]?.(text) ?? 0;
    return measureWithFonts(metricsFont, measure, input, safety);
  };
};
