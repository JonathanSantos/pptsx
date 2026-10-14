import { basename } from 'node:path';
import type * as Pptx from './pptx.ts';
import { resolveAssetPath } from '../core/assets.ts';
import { DEFAULTS, imageFitOf, strokeColorOf, textStyleOf } from '../core/defaults.ts';
import type {
  Color,
  LineBreaks,
  PositionedBox,
  PositionedImage,
  PositionedShape,
  PositionedSlide,
  PositionedText,
  Rect,
  ShapeKind,
  StrokeProps,
} from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { ACTIVE_LINE_SPACING, lineSpacingOf, type LineSpacingStrategy } from './calibration.ts';

/**
 * Funções puras: nó posicionado → opções do pptxgenjs. Nenhuma toca a
 * instância do pptx, então são testáveis isoladamente.
 */

export interface InchPosition {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ShapeSpec {
  readonly shape: Pptx.ShapeName;
  readonly options: Pptx.ShapeProps;
}

export interface TextSpec {
  readonly runs: Pptx.TextProps[];
  readonly options: Pptx.TextPropsOptions;
}

const DEBUG_OUTLINE = { color: 'FF0000', width: 0.5, dashType: 'dash' } as const;

const SHAPE_NAMES: Readonly<Record<ShapeKind, Pptx.ShapeName>> = {
  rect: 'rect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  line: 'line',
};

/** pptxgenjs espera hex sem '#'. */
export const hexOf = (color: Color): string => color.replace(/^#/, '').toUpperCase();

export const positionOf = (frame: Rect): InchPosition => ({
  x: ptToInches(frame.x),
  y: ptToInches(frame.y),
  w: ptToInches(frame.width),
  h: ptToInches(frame.height),
});

/** Sem fill, omitimos a chave: o pptxgenjs só escreve <a:noFill/> quando ela não existe. */
const fillOf = (fill: Color | undefined): { readonly fill?: Pptx.ShapeFillProps } =>
  fill === undefined ? {} : { fill: { type: 'solid', color: hexOf(fill) } };

const lineOf = (props: StrokeProps): Pptx.ShapeLineProps | undefined => {
  if (props.stroke === undefined) return undefined;
  return { color: hexOf(props.stroke), width: props.strokeWidth ?? DEFAULTS.strokeWidth };
};

/**
 * pptxgenjs v4 interpreta rectRadius em POLEGADAS (adj = r·EMU·100000 / min(w,h)),
 * apesar do .d.ts dizer 0–1. Limitamos a metade do menor lado, que é o máximo
 * geométrico do roundRect.
 */
export const rectRadiusOf = (radius: number, frame: Rect): number =>
  ptToInches(Math.min(radius, Math.min(frame.width, frame.height) / 2));

const geometryOf = (kind: ShapeKind, radius: number | undefined, frame: Rect) => {
  if (kind !== 'roundRect' || !radius || radius <= 0) return {};
  return { rectRadius: rectRadiusOf(radius, frame) };
};

const shapeSpecOf = (kind: ShapeKind, props: StrokeProps & { readonly radius?: number }, frame: Rect): ShapeSpec => {
  const line = lineOf(props);
  return {
    shape: SHAPE_NAMES[kind],
    options: {
      ...positionOf(frame),
      ...fillOf(props.fill),
      ...(line ? { line } : {}),
      ...geometryOf(kind, props.radius, frame),
    },
  };
};

/** Box só desenha algo quando tem fill ou stroke; senão é só contêiner. */
export const boxShapeOf = (node: PositionedBox): ShapeSpec | undefined => {
  const { fill, stroke, radius } = node.props;
  if (fill === undefined && stroke === undefined) return undefined;
  const kind: ShapeKind = radius !== undefined && radius > 0 ? 'roundRect' : 'rect';
  return shapeSpecOf(kind, node.props, node.frame);
};

/** Shape 'line' usa o próprio frame: pptxgenjs desenha da quina sup. esq. à inf. dir. */
export const shapeOf = (node: PositionedShape): ShapeSpec =>
  shapeSpecOf(node.props.kind, { ...node.props, stroke: strokeColorOf(node.props) }, node.frame);

/**
 * Duas estratégias de quebra (Strategy por `LineBreaks`):
 * - 'forced' (padrão, decisão do gate do M3): um run por linha calculada. Linhas
 *   do mesmo parágrafo são unidas por quebra suave (softBreakBefore → <a:br/>) e
 *   o último run de cada parágrafo, exceto o final, fecha o <a:p> (breakLine).
 *   Assim o renderizador não requebra o texto com a própria métrica; com quebra
 *   automática o Keynote punha mais palavras por linha que a engine (11/34 na
 *   calibração; 34/34 com a quebra forçada).
 * - 'auto': um run por parágrafo do autor; o renderizador quebra sozinho. O
 *   texto fica editável como texto corrido (editar uma palavra não deixa linhas
 *   órfãs), ao custo de poder divergir em 1 linha da engine. A caixa mantém o
 *   frame calculado, então a divergência aparece como sobra/estouro de 1 linha.
 * Runs separados (em vez de '\n') nas duas: o pptxgenjs ignora todas as
 * quebras quando o texto termina em '\n'.
 */
const lineRunOf = (text: string, softBreakBefore: boolean, breakLine: boolean): Pptx.TextProps => ({
  text,
  options: { ...(softBreakBefore ? { softBreakBefore } : {}), ...(breakLine ? { breakLine } : {}) },
});

// Parágrafo vazio vira um run vazio: o <a:p> continua ocupando uma linha.
const linesOrEmpty = (lines: readonly string[]): readonly string[] => (lines.length === 0 ? [''] : lines);

export const paragraphRunsOf = (paragraphs: readonly (readonly string[])[]): Pptx.TextProps[] =>
  paragraphs.flatMap((lines, paragraphIndex) => {
    const closesParagraph = paragraphIndex < paragraphs.length - 1;
    const texts = linesOrEmpty(lines);
    return texts.map((text, lineIndex) => lineRunOf(text, lineIndex > 0, closesParagraph && lineIndex === texts.length - 1));
  });

const BREAKS_WITHOUT_SPACE = ['-', '/'];

// O quebrador corta em espaço (consumido) ou logo depois de '-'/'/' (mantido no
// fim da linha); só no primeiro caso a junção precisa devolver o espaço.
const separatorAfter = (line: string): string => (BREAKS_WITHOUT_SPACE.some((c) => line.endsWith(c)) ? '' : ' ');

/** Linhas calculadas unidas em texto corrido; só para truncado, que precisa manter a reticência. */
export const joinedLinesOf = (lines: readonly string[]): string =>
  // O acumulado termina com a linha anterior, então decide o separador por ele.
  lines.reduce((text, line, index) => (index === 0 ? line : text + separatorAfter(text) + line), '');

// Mesma normalização de espaços do medidor (segmentsOf em text/lines.ts).
const normalizeSpaces = (paragraph: string): string => paragraph.split(/\s+/).filter(Boolean).join(' ');

/**
 * Parágrafos do autor ('\n'), com espaços normalizados. Reconstruir a partir das
 * linhas erra em palavra quebrada por caractere (espaço falso) e em "a - b"
 * (o espaço antes do '-' some); o texto original não tem esse problema.
 */
export const authorParagraphsOf = (content: string): readonly string[] => content.split('\n').map(normalizeSpaces);

/**
 * Texto do run de um parágrafo em 'auto': o original do autor quando existe;
 * sem ele (texto truncado), as linhas calculadas unidas, com a reticência.
 */
export const paragraphTextOf = (lines: readonly string[], original?: string): string =>
  original ?? joinedLinesOf(lines);

/** `authorParagraphs` ausente = truncado: cai nas linhas calculadas. */
export const autoParagraphRunsOf = (
  paragraphs: readonly (readonly string[])[],
  authorParagraphs?: readonly string[],
): Pptx.TextProps[] =>
  paragraphs.map((lines, index) => lineRunOf(paragraphTextOf(lines, authorParagraphs?.[index]), false, index < paragraphs.length - 1));

type RunStrategy = (paragraphs: readonly (readonly string[])[], authorParagraphs?: readonly string[]) => Pptx.TextProps[];

const RUN_STRATEGIES: Readonly<Record<LineBreaks, RunStrategy>> = {
  forced: (paragraphs) => paragraphRunsOf(paragraphs),
  auto: autoParagraphRunsOf,
};

/** `authorParagraphs` só é lido em 'auto'; ver authorParagraphsOf. */
export const runsOf = (
  paragraphs: readonly (readonly string[])[],
  lineBreaks: LineBreaks = DEFAULTS.lineBreaks,
  authorParagraphs?: readonly string[],
): Pptx.TextProps[] => RUN_STRATEGIES[lineBreaks](paragraphs, authorParagraphs);

// Truncado não tem original confiável: os parágrafos depois do corte somem e o último ganha '…'.
const authorParagraphsOfNode = (node: PositionedText): readonly string[] | undefined =>
  node.text.truncated ? undefined : authorParagraphsOf(node.content);

export const textOf = (
  node: PositionedText,
  lineSpacing: LineSpacingStrategy = ACTIVE_LINE_SPACING,
  lang: string = DEFAULTS.lang,
  lineBreaks: LineBreaks = DEFAULTS.lineBreaks,
): TextSpec => {
  const style = textStyleOf(node.props);
  return {
    runs: runsOf(node.text.paragraphs, lineBreaks, authorParagraphsOfNode(node)),
    options: {
      ...positionOf(node.frame),
      margin: 0,
      valign: 'top',
      // fit 'none' e paraSpace 0 não geram XML (o pptxgenjs descarta falsy e
      // trata 'none' como ausência). Fica correto mesmo assim: shape sem
      // placeholder herda otherStyle/defaultTextStyle, que não têm spcBef/
      // spcAft nem autofit, e o padrão OOXML é espaço 0 e sem autofit.
      fit: 'none',
      wrap: true,
      paraSpaceBefore: 0,
      paraSpaceAfter: 0,
      ...lineSpacingOf(node, lineSpacing),
      fontFace: style.family,
      fontSize: node.text.fontSize,
      bold: style.weight === 'bold',
      italic: style.italic,
      color: hexOf(node.props.color ?? DEFAULTS.text.color),
      align: node.props.align ?? DEFAULTS.text.align,
      lang,
    },
  };
};

/**
 * Com sizing, o pptxgenjs usa w/h só como proporção da imagem original
 * (e trata número ≥ 100 como EMU), então passamos a proporção intrínseca
 * escalada para a largura do frame; o tamanho final vem de sizing.
 */
export const imageOf = (node: PositionedImage, baseDir: string): Pptx.ImageProps => {
  const box = positionOf(node.frame);
  const { width, height } = node.intrinsic;
  const ratio = width > 0 && height > 0 ? height / width : box.h / box.w;
  return {
    path: resolveAssetPath(baseDir, node.props.src),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.w * ratio,
    sizing: { type: imageFitOf(node.props), w: box.w, h: box.h },
    // Sem isso o pptxgenjs grava o caminho absoluto local como texto alternativo.
    altText: basename(node.props.src),
  };
};

export const debugOutlineOf = (frame: Rect): ShapeSpec => ({
  shape: 'rect',
  options: { ...positionOf(frame), line: { ...DEBUG_OUTLINE } },
});

export const backgroundOf = (slide: PositionedSlide, baseDir: string): Pptx.BackgroundProps | undefined => {
  const { background } = slide.props;
  if (background === undefined) return undefined;
  if (typeof background === 'string') return { color: hexOf(background) };
  return { path: resolveAssetPath(baseDir, background.image) };
};
