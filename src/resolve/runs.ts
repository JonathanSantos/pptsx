import { DEFAULTS } from '../core/defaults.ts';
import type { SpanProps, TextChildren, TextProps, TextRun } from '../core/types.ts';
import { ResolveError } from './errors.ts';
import { expandChild } from './expand.ts';
import type { Expanded } from './expand.ts';

type RunStyle = Omit<TextRun, 'text'>;

const TEXT_CHILD_ERROR = '<Text> só aceita strings, números e <Span>/<B>/<I> como filhos';

const baseStyleOf = (props: Omit<TextProps, 'children'>): RunStyle => ({
  weight: props.weight ?? DEFAULTS.text.weight,
  italic: props.italic ?? DEFAULTS.text.italic,
  color: props.color ?? DEFAULTS.text.color,
});

// Só o que o Span declara sobrescreve; o resto vem do estilo herdado.
const overrideStyle = (style: RunStyle, span: SpanProps): RunStyle => ({
  weight: span.weight ?? style.weight,
  italic: span.italic ?? style.italic,
  color: span.color ?? style.color,
});

const sameStyle = (a: RunStyle, b: RunStyle): boolean =>
  a.weight === b.weight && a.italic === b.italic && a.color === b.color;

/** Percorre os filhos em ordem; cada trecho de texto vira um run com o estilo do caminho até ele. */
const collectRuns = (children: TextChildren, style: RunStyle, path: string): readonly TextRun[] =>
  expandChild(children).flatMap((item: Expanded): readonly TextRun[] => {
    if (item.type === 'text') return [{ text: String(item.value), ...style }];
    if (item.kind !== 'span') throw new ResolveError(TEXT_CHILD_ERROR, path);
    const span = item.element.props as SpanProps;
    return collectRuns(span.children, overrideStyle(style, span), path);
  });

const mergeAdjacent = (runs: readonly TextRun[]): readonly TextRun[] =>
  runs.reduce<readonly TextRun[]>((merged, run) => {
    if (run.text === '') return merged;
    const last = merged[merged.length - 1];
    if (last === undefined || !sameStyle(last, run)) return [...merged, run];
    return [...merged.slice(0, -1), { ...last, text: last.text + run.text }];
  }, []);

/** Runs fundidos de um Text; `content` é a concatenação deles. */
export const runsOf = (
  children: TextChildren,
  props: Omit<TextProps, 'children'>,
  path: string,
): readonly TextRun[] => mergeAdjacent(collectRuns(children, baseStyleOf(props), path));
