import type * as Pptx from './pptx.ts';
import { DEFAULTS, textStyleOf } from '../core/defaults.ts';
import type { Color, LineBreaks, LineRun, PositionedText, TextLayout, TextRun } from '../core/types.ts';

/**
 * Texto → runs do pptxgenjs (M8: rich text). Funções puras.
 *
 * Duas estratégias de quebra (Strategy por `LineBreaks`):
 * - 'forced' (padrão, decisão do gate do M3): cada linha calculada vira um ou mais
 *   runs (um por `LineRun`). Linhas do mesmo parágrafo são unidas por quebra suave
 *   (softBreakBefore no 1º run da linha → <a:br/>) e o último run da última linha de
 *   cada parágrafo, exceto o final, fecha o <a:p> (breakLine). Assim o renderizador
 *   não requebra o texto com a própria métrica; com quebra automática o Keynote punha
 *   mais palavras por linha que a engine (11/34 na calibração; 34/34 com a forçada).
 * - 'auto': um <a:p> por parágrafo do autor, com um run por `TextRun`; o renderizador
 *   quebra sozinho. O texto fica editável como texto corrido, ao custo de poder
 *   divergir em 1 linha da engine. A caixa mantém o frame calculado.
 * Runs separados (em vez de '\n') nas duas: o pptxgenjs ignora todas as quebras
 * quando o texto termina em '\n'.
 */

/** O que pode variar entre runs de um Text; fonte, size e lang são da caixa. */
export interface RunStyle {
  readonly bold: boolean;
  readonly italic: boolean;
  /** Hex sem '#', como o pptxgenjs espera. */
  readonly color: string;
}

/** Pedaço de texto com estilo: vira um <a:r>. */
export interface StyledText {
  readonly text: string;
  readonly style: RunStyle;
}

export type StyledLine = readonly StyledText[];
export type StyledParagraph = readonly StyledLine[];

/** pptxgenjs espera hex sem '#'. */
export const hexOf = (color: Color): string => color.replace(/^#/, '').toUpperCase();

export const baseStyleOf = (node: PositionedText): RunStyle => {
  const style = textStyleOf(node.props);
  return { bold: style.weight === 'bold', italic: style.italic, color: hexOf(node.props.color ?? DEFAULTS.text.color) };
};

const runStyleOf = (run: TextRun): RunStyle => ({ bold: run.weight === 'bold', italic: run.italic, color: hexOf(run.color) });

// Guards: árvores montadas antes do M8 (ou à mão) podem não ter runs/lineRuns;
// aí cai para um run por linha com o estilo do Text.
const textRunsOf = (node: PositionedText): readonly TextRun[] => (Array.isArray(node.runs) ? node.runs : []);

export const lineRunsOf = (layout: TextLayout): readonly (readonly LineRun[])[] | undefined =>
  Array.isArray(layout.lineRuns) && layout.lineRuns.length === layout.lines.length ? layout.lineRuns : undefined;

const styleAt = (runs: readonly TextRun[], index: number, base: RunStyle): RunStyle => {
  const run = runs[index];
  return run === undefined ? base : runStyleOf(run);
};

const lastOf = <T>(items: readonly T[]): T | undefined => items[items.length - 1];

const replaceLast = <T>(items: readonly T[], item: T): readonly T[] => [...items.slice(0, -1), item];

const sameStyle = (a: RunStyle, b: RunStyle): boolean => a.bold === b.bold && a.italic === b.italic && a.color === b.color;

/** Funde pedaços vizinhos com o mesmo estilo (ex.: um run que atravessou linhas). */
export const mergeAdjacent = (line: StyledLine): StyledLine =>
  line.reduce<StyledLine>((merged, piece) => {
    const last = lastOf(merged);
    if (last === undefined || !sameStyle(last.style, piece.style)) return [...merged, piece];
    return replaceLast(merged, { ...last, text: last.text + piece.text });
  }, []);

// ───────────── 'forced' ─────────────

/** Fatia uma lista achatada por linha em grupos com o tamanho de cada parágrafo. */
const groupByParagraph = <T>(items: readonly T[], paragraphs: readonly (readonly string[])[]): readonly (readonly T[])[] => {
  const starts = paragraphs.reduce<readonly number[]>((acc, lines) => [...acc, (lastOf(acc) ?? 0) + lines.length], [0]);
  return paragraphs.map((lines, index) => items.slice(starts[index], (starts[index] ?? 0) + lines.length));
};

const styledLineOf = (lineRuns: readonly LineRun[], runs: readonly TextRun[], base: RunStyle): StyledLine =>
  lineRuns.map((lineRun) => ({ text: lineRun.text, style: styleAt(runs, lineRun.run, base) }));

/** Linhas calculadas por parágrafo, cada uma dividida pelos runs. */
export const computedParagraphsOf = (node: PositionedText, base: RunStyle = baseStyleOf(node)): readonly StyledParagraph[] => {
  const { paragraphs } = node.text;
  const lineRuns = lineRunsOf(node.text);
  if (lineRuns === undefined) return paragraphs.map((lines) => lines.map((text) => [{ text, style: base }]));
  const runs = textRunsOf(node);
  return groupByParagraph(lineRuns, paragraphs).map((lines) => lines.map((line) => styledLineOf(line, runs, base)));
};

// ───────────── 'auto' ─────────────

// Mesma normalização de espaços do medidor: \s colapsa, exceto NBSP (U+00A0), que é glue (M8).
const SPACES = /[^\S ]+/g;

const BREAKS_WITHOUT_SPACE = ['-', '/'];

// O quebrador corta em espaço (consumido) ou logo depois de '-'/'/' (mantido no
// fim da linha); só no primeiro caso a junção precisa devolver o espaço.
const separatorAfter = (line: string): string => (BREAKS_WITHOUT_SPACE.some((c) => line.endsWith(c)) ? '' : ' ');

const textOfLine = (line: StyledLine): string => line.map((piece) => piece.text).join('');

/** Linhas calculadas unidas em texto corrido; só para truncado, que precisa manter a reticência. */
export const joinedLinesOf = (lines: readonly StyledLine[]): StyledLine =>
  lines.reduce<StyledLine>((joined, line, index) => {
    const last = lastOf(joined);
    if (index === 0 || last === undefined) return [...joined, ...line];
    // O acumulado termina com a linha anterior, então decide o separador por ele.
    const separator = separatorAfter(textOfLine(joined));
    return [...replaceLast(joined, { ...last, text: last.text + separator }), ...line];
  }, []);

/** Divide os runs nos '\n' do autor: um run que cruza '\n' vira um pedaço em cada parágrafo. */
export const splitParagraphs = (pieces: StyledLine): readonly StyledLine[] =>
  pieces.reduce<readonly StyledLine[]>(
    (paragraphs, piece) => {
      const [first = '', ...rest] = piece.text.split('\n');
      const current = lastOf(paragraphs) ?? [];
      const opened = replaceLast(paragraphs, [...current, { ...piece, text: first }]);
      return [...opened, ...rest.map((text) => [{ ...piece, text }])];
    },
    [[]],
  );

interface Normalizing {
  readonly pieces: StyledLine;
  /** Texto acumulado vazio ou terminando em espaço: o espaço inicial do próximo pedaço sobra. */
  readonly open: boolean;
}

const appendNormalized = (acc: Normalizing, piece: StyledText): Normalizing => {
  const collapsed = piece.text.replace(SPACES, ' ');
  const text = acc.open ? collapsed.replace(/^ /, '') : collapsed;
  if (text === '') return acc;
  return { pieces: [...acc.pieces, { ...piece, text }], open: text.endsWith(' ') };
};

const trimEnd = (pieces: StyledLine): StyledLine => {
  const last = lastOf(pieces);
  if (last === undefined || !last.text.endsWith(' ')) return pieces;
  const text = last.text.slice(0, -1);
  return text === '' ? pieces.slice(0, -1) : replaceLast(pieces, { ...last, text });
};

/** Espaços do parágrafo normalizados como o medidor, através das fronteiras de run. */
export const normalizeParagraph = (pieces: StyledLine): StyledLine =>
  trimEnd(pieces.reduce(appendNormalized, { pieces: [], open: true }).pieces);

const authorPiecesOf = (node: PositionedText, base: RunStyle): StyledLine => {
  const runs = textRunsOf(node);
  if (runs.length === 0) return [{ text: node.content, style: base }];
  return runs.map((run) => ({ text: run.text, style: runStyleOf(run) }));
};

/**
 * Parágrafos do autor divididos pelos runs. Reconstruir a partir das linhas erra em
 * palavra quebrada por caractere (espaço falso) e em "a - b" (o espaço antes do '-'
 * some); o texto original não tem esse problema. Truncado não tem original
 * confiável (os parágrafos depois do corte somem e o último ganha '…'), então usa
 * as linhas calculadas unidas.
 */
export const authorParagraphsOf = (node: PositionedText, base: RunStyle = baseStyleOf(node)): readonly StyledParagraph[] => {
  const paragraphs = node.text.truncated
    ? computedParagraphsOf(node, base).map(joinedLinesOf)
    : splitParagraphs(authorPiecesOf(node, base)).map(normalizeParagraph);
  return paragraphs.map((line) => [mergeAdjacent(line)]);
};

// ───────────── runs do pptxgenjs ─────────────

/**
 * Estilo explícito em todo run: o pptxgenjs só herda da caixa as chaves falsy do run,
 * então um run regular num Text bold sairia bold se a caixa levasse bold.
 */
const pptxRunOf = (piece: StyledText, softBreakBefore: boolean, breakLine: boolean): Pptx.TextProps => ({
  text: piece.text,
  options: {
    bold: piece.style.bold,
    italic: piece.style.italic,
    color: piece.style.color,
    ...(softBreakBefore ? { softBreakBefore } : {}),
    ...(breakLine ? { breakLine } : {}),
  },
});

// Linha ou parágrafo vazio vira um run vazio: o <a:p> continua ocupando uma linha.
const lineOrEmpty = (line: StyledLine, base: RunStyle): StyledLine => (line.length === 0 ? [{ text: '', style: base }] : line);

const paragraphOrEmpty = (paragraph: StyledParagraph): StyledParagraph => (paragraph.length === 0 ? [[]] : paragraph);

/** softBreakBefore só no 1º run de cada linha depois da 1ª; breakLine só no último run do parágrafo. */
export const pptxRunsOf = (paragraphs: readonly StyledParagraph[], base: RunStyle): Pptx.TextProps[] =>
  paragraphs.flatMap((paragraph, paragraphIndex) => {
    const closesParagraph = paragraphIndex < paragraphs.length - 1;
    const lines = paragraphOrEmpty(paragraph).map((line) => lineOrEmpty(line, base));
    return lines.flatMap((line, lineIndex) =>
      line.map((piece, pieceIndex) =>
        pptxRunOf(
          piece,
          lineIndex > 0 && pieceIndex === 0,
          closesParagraph && lineIndex === lines.length - 1 && pieceIndex === line.length - 1,
        ),
      ),
    );
  });

const PARAGRAPH_STRATEGIES: Readonly<Record<LineBreaks, (node: PositionedText, base: RunStyle) => readonly StyledParagraph[]>> = {
  forced: computedParagraphsOf,
  auto: authorParagraphsOf,
};

export const textRunsOfNode = (node: PositionedText, lineBreaks: LineBreaks = DEFAULTS.lineBreaks): Pptx.TextProps[] => {
  const base = baseStyleOf(node);
  return pptxRunsOf(PARAGRAPH_STRATEGIES[lineBreaks](node, base), base);
};
