import type { CssSpanProps } from '../core/css-props.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { FontWeight, TextChildren, TextRun, TextTransform, VerticalAlign } from '../core/types.ts';
import { hexOf } from './colors.ts';
import { InvalidPropError, ResolveError } from './errors.ts';
import { expandChild } from './expand.ts';
import type { Expanded } from './expand.ts';
import { parseFontWeight, parsePt } from './values.ts';
import { parseFontFamily } from './text-handlers.ts';
import { parseHref } from './href.ts';

/**
 * Runs de um Text: cada trecho de texto vira um run com o estilo do caminho até ele. O estilo
 * base vem da cascata; o Span aceita weight/italic e fontWeight/fontStyle/textDecoration; o
 * textTransform é aplicado antes de medir (o PPTX recebe o texto já transformado).
 */

export type RunStyle = Omit<TextRun, 'text'>;

const TEXT_CHILD_ERROR = '<Text> só aceita strings, números e <Span>/<B>/<I> como filhos';

const spanWeightOf = (span: CssSpanProps): FontWeight | undefined => {
  const raw = span.weight ?? span.fontWeight;
  return raw === undefined ? undefined : parseFontWeight(raw);
};

const spanItalicOf = (span: CssSpanProps): boolean | undefined =>
  span.italic ?? (span.fontStyle === undefined ? undefined : span.fontStyle === 'italic');

const decorationOf = (value: string | undefined, token: string): boolean | undefined =>
  value === undefined ? undefined : value.split(/\s+/).includes(token);

// Só o que o Span declara sobrescreve; o resto vem do estilo herdado.
const overrideStyle = (style: RunStyle, span: CssSpanProps): RunStyle => ({
  weight: spanWeightOf(span) ?? style.weight,
  italic: spanItalicOf(span) ?? style.italic,
  color: span.color === undefined ? style.color : hexOf('color', span.color),
  underline: decorationOf(span.textDecoration, 'underline') ?? style.underline ?? false,
  lineThrough: decorationOf(span.textDecoration, 'line-through') ?? style.lineThrough ?? false,
  ...verticalAlignOf(span.verticalAlign ?? style.verticalAlign),
  ...sizeOf(span.fontSize, style.size),
  ...familyOf(span.fontFamily, style.family),
  ...hrefOf(span.href, style.href),
});

/** M13-7: corpo do Span (pt, '14px'); herdado de um Span de fora. */
const sizeOf = (own: unknown, inherited: number | undefined): Pick<TextRun, 'size'> => {
  if (own === undefined) return inherited === undefined ? {} : { size: inherited };
  const size = parsePt(own);
  if (size === undefined || size <= 0) throw new InvalidPropError('fontSize', own, 'use um tamanho positivo em pt (número ou "14px")');
  return { size };
};

const familyOf = (own: unknown, inherited: string | undefined): Pick<TextRun, 'family'> => {
  if (own === undefined) return inherited === undefined ? {} : { family: inherited };
  const family = parseFontFamily(own);
  if (family === undefined) throw new InvalidPropError('fontFamily', own, 'use o nome de uma família registrada');
  return { family };
};

/** O href do Span vence o herdado (do Text ou de um Span de fora). */
const hrefOf = (own: unknown, inherited: string | undefined): Pick<TextRun, 'href'> => {
  const href = own === undefined ? inherited : parseHref('href', own);
  return href === undefined ? {} : { href };
};

const VERTICAL_ALIGNS: readonly VerticalAlign[] = ['baseline', 'super', 'sub'];

/** 'baseline' é o padrão: não entra no run (runs antigos e novos comparam igual). */
const verticalAlignOf = (value: unknown): Pick<TextRun, 'verticalAlign'> => {
  if (value === undefined || value === 'baseline') return {};
  if (!VERTICAL_ALIGNS.includes(value as VerticalAlign)) throw new InvalidPropError('verticalAlign', value, 'use "baseline", "super" ou "sub"');
  return { verticalAlign: value as VerticalAlign };
};

const spanStyleOf = (style: RunStyle, span: CssSpanProps, path: string): RunStyle => {
  try {
    return overrideStyle(style, span);
  } catch (error) {
    if (!(error instanceof InvalidPropError)) throw error;
    throw new ResolveError(`Prop "${error.property}" de <Span>: ${error.message}`, path);
  }
};

const sameStyle = (a: RunStyle, b: RunStyle): boolean =>
  a.weight === b.weight &&
  a.italic === b.italic &&
  a.color === b.color &&
  (a.underline ?? false) === (b.underline ?? false) &&
  (a.lineThrough ?? false) === (b.lineThrough ?? false) &&
  (a.verticalAlign ?? 'baseline') === (b.verticalAlign ?? 'baseline') &&
  a.href === b.href &&
  a.size === b.size &&
  a.family === b.family;

const collectRuns = (children: TextChildren, style: RunStyle, path: string): readonly TextRun[] =>
  expandChild(children).flatMap((item: Expanded): readonly TextRun[] => {
    if (item.type === 'text') return [{ text: String(item.value), ...style }];
    if (item.kind !== 'span') throw new ResolveError(TEXT_CHILD_ERROR, path);
    const span = item.element.props as CssSpanProps;
    return collectRuns(span.children, spanStyleOf(style, span, path), path);
  });

const mergeAdjacent = (runs: readonly TextRun[]): readonly TextRun[] =>
  runs.reduce<readonly TextRun[]>((merged, run) => {
    if (run.text === '') return merged;
    const last = merged[merged.length - 1];
    if (last === undefined || !sameStyle(last, run)) return [...merged, run];
    return [...merged.slice(0, -1), { ...last, text: last.text + run.text }];
  }, []);

// capitalize: 1ª letra de cada palavra, como o CSS (o resto fica como está).
const TRANSFORMS: Readonly<Record<TextTransform, (text: string) => string>> = {
  none: (text) => text,
  uppercase: (text) => text.toLocaleUpperCase(DEFAULTS.lang),
  lowercase: (text) => text.toLocaleLowerCase(DEFAULTS.lang),
  capitalize: (text) => text.replace(/(^|[\s \-/])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase(DEFAULTS.lang)),
};

/**
 * capitalize olha a fronteira de palavra através dos runs: o run seguinte começa palavra só
 * se o anterior terminou em espaço.
 */
const transformRuns = (runs: readonly TextRun[], transform: TextTransform): readonly TextRun[] => {
  if (transform !== 'capitalize') return runs.map((run) => ({ ...run, text: TRANSFORMS[transform](run.text) }));
  return runs.reduce<readonly TextRun[]>((done, run) => {
    const previous = done.map((r) => r.text).join('');
    const glued = previous !== '' && !/[\s \-/]$/.test(previous);
    const text = TRANSFORMS.capitalize(glued ? `x${run.text}` : run.text);
    return [...done, { ...run, text: glued ? text.slice(1) : text }];
  }, []);
};

/** Runs fundidos e transformados de um Text; `content` é a concatenação deles. */
export const runsOf = (children: TextChildren, base: RunStyle, transform: TextTransform, path: string): readonly TextRun[] =>
  transformRuns(mergeAdjacent(collectRuns(children, base, path)), transform);
