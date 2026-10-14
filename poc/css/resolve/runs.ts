import { ResolveError } from '../../../src/resolve/errors.ts';
import { expandChild, type Expanded } from '../../../src/resolve/expand.ts';
import type { FontWeight, TextChildren } from '../../../src/core/types.ts';
import type { CssSpanProps } from '../css-props.ts';
import type { TextRun, TextTransform } from '../types.ts';
import { parseFontWeight } from './values.ts';

/**
 * Runs de um Text (cópia do src/resolve/runs.ts) com o que a PoC acrescenta: o Span aceita
 * fontWeight/fontStyle/textDecoration, o estilo base vem da cascata e o textTransform é
 * aplicado ao texto antes de medir (o PPTX recebe o texto já transformado).
 */

type RunStyle = Omit<TextRun, 'text'>;

const TEXT_CHILD_ERROR = '<Text> só aceita strings, números e <Span>/<B>/<I> como filhos';

const spanWeightOf = (span: CssSpanProps): FontWeight | undefined =>
  span.weight ?? (span.fontWeight === undefined ? undefined : parseFontWeight(span.fontWeight)?.weight);

const spanItalicOf = (span: CssSpanProps): boolean | undefined =>
  span.italic ?? (span.fontStyle === undefined ? undefined : span.fontStyle === 'italic');

const decorationOf = (value: string | undefined, token: string): boolean | undefined =>
  value === undefined ? undefined : value.split(/\s+/).includes(token);

// Só o que o Span declara sobrescreve; o resto vem do estilo herdado.
const overrideStyle = (style: RunStyle, span: CssSpanProps): RunStyle => ({
  weight: spanWeightOf(span) ?? style.weight,
  italic: spanItalicOf(span) ?? style.italic,
  color: span.color ?? style.color,
  underline: decorationOf(span.textDecoration, 'underline') ?? style.underline ?? false,
  lineThrough: decorationOf(span.textDecoration, 'line-through') ?? style.lineThrough ?? false,
});

const sameStyle = (a: RunStyle, b: RunStyle): boolean =>
  a.weight === b.weight &&
  a.italic === b.italic &&
  a.color === b.color &&
  (a.underline ?? false) === (b.underline ?? false) &&
  (a.lineThrough ?? false) === (b.lineThrough ?? false);

const collectRuns = (children: TextChildren, style: RunStyle, path: string): readonly TextRun[] =>
  expandChild(children).flatMap((item: Expanded): readonly TextRun[] => {
    if (item.type === 'text') return [{ text: String(item.value), ...style }];
    if (item.kind !== 'span') throw new ResolveError(TEXT_CHILD_ERROR, path);
    const span = item.element.props as CssSpanProps;
    return collectRuns(span.children, overrideStyle(style, span), path);
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
  uppercase: (text) => text.toLocaleUpperCase('pt-BR'),
  lowercase: (text) => text.toLocaleLowerCase('pt-BR'),
  capitalize: (text) => text.replace(/(^|[\s \-/])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase('pt-BR')),
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

export const cssRunsOf = (children: TextChildren, base: RunStyle, transform: TextTransform, path: string): readonly TextRun[] =>
  transformRuns(mergeAdjacent(collectRuns(children, base, path)), transform);
