import type { Font } from 'fontkit';
import { DEFAULTS, weightValueOf } from '../core/defaults.ts';
import type { FontWeight, Pt, RunFace, TextLayout, TextMeasureInput, TextMeasurer } from '../core/types.ts';
import { brokenWordsOf } from './broken.ts';
import { createEstimateMeasurer } from './estimate.ts';
import { lineBoxOf, spacingOf, type LineBox } from './leading.ts';
import { layoutText } from './lines.ts';
import type { MeasureRun } from './pieces.ts';
import type { FaceMatch, FontRegistry } from './registry.ts';
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

// O espaçamento entra depois do cache: o cache é em unidades da fonte e não depende dele.
const measureWidthOf =
  (unitWidth: UnitWidth, unitsPerEm: number, size: Pt, letterSpacing: Pt): ((text: string) => Pt) =>
  (text) =>
    text.length === 0 ? 0 : (unitWidth(text.replace(NBSP, ' ')) * size) / unitsPerEm + spacingOf(text, letterSpacing);

/**
 * Linha natural da face (`line-height: normal`): altura ascent − descent + lineGap; topo
 * da linha → baseline = ascent. O lineGap não entra no ascent: fica abaixo do descent,
 * como no PowerPoint (calibração M3-F).
 */
const naturalLineBox = ({ unitsPerEm, ascent, descent, lineGap }: VerticalMetrics, size: Pt): LineBox => ({
  lineHeight: ((ascent - descent + lineGap) / unitsPerEm) * size,
  ascent: (ascent / unitsPerEm) * size,
});

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

const { regular: NORMAL, bold: BOLD } = DEFAULTS.text.weights;

/**
 * M13: o que o PPTX recebe para a face escolhida. 400/700 = família do autor + flag negrito;
 * outro peso = nome de família da própria face (name ID 1, ex.: "Inter SemiBold") sem negrito,
 * que é como PowerPoint/Keynote acham a face instalada ou embutida.
 */
export const runFaceOf = (family: string, match: FaceMatch, wanted: FontWeight): RunFace => {
  const canonical = match.weight === NORMAL || match.weight === BOLD;
  const requested = weightValueOf(wanted);
  const previewFamily = match.font.getName('preferredFamily', 'en') ?? match.font.familyName;
  return {
    typeface: canonical ? family : match.font.familyName,
    bold: match.weight === BOLD,
    weight: match.weight,
    previewFamily,
    ...(Math.abs(requested - match.weight) > DEFAULTS.text.weightTolerance ? { requested } : {}),
  };
};

const measureWithFonts = (
  metricsFont: Font,
  measure: MeasureRun,
  input: TextMeasureInput,
  safety: number,
): TextLayout => {
  const { size } = input.style;
  const nowrap = input.nowrap === true;
  // Infinity × safety continua Infinity: texto sem limite nunca quebra.
  const laid = layoutText(input, input.maxWidth * safety, measure);
  const { lineHeight, ascent } = lineBoxOf(naturalLineBox(metricsOf(metricsFont), size), size, input.style.lineHeight);
  return {
    lines: laid.lines,
    paragraphs: laid.paragraphs,
    lineRuns: laid.lineRuns,
    fontSize: size,
    lineHeight,
    ascent,
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
    const runs = runsOfInput(input);
    const matches = runs.map((run) => registry.match(family, run.weight, run.italic));
    const found = matches.map((match) => match?.font);
    const fonts = found.filter((font): font is Font => font !== undefined);
    if (fonts.length !== found.length) return { ...estimate(input), fontMissing: true };
    const faces = matches.map((match, index) => runFaceOf(family, match!, runs[index]!.weight));
    const [firstFont] = fonts;
    // A altura da linha é única e vem da face do estilo; se só as faces dos runs existem
    // (ex.: <Text font="X"><B>…</B></Text> com X só em bold), usa-se a do primeiro run.
    const metricsFont = registry.get(family, weight, italic) ?? firstFont;
    if (metricsFont === undefined) return { ...estimate(input), fontMissing: true };
    const spacing = input.letterSpacing ?? 0;
    const widths = fonts.map((font) => measureWidthOf(unitWidthOf(font), font.unitsPerEm, size, spacing));
    const measure: MeasureRun = (text, run) => widths[run]?.(text) ?? 0;
    return { ...measureWithFonts(metricsFont, measure, input, safety), faces };
  };
};
