import { pickResponsive, responsiveProblemOf } from '../core/responsive.ts';
import type { ResponsiveContext } from '../core/responsive.ts';
import type { NonResponsiveKey, PrimitiveKind, PrimitivePropsMap, SlideElement } from '../core/types.ts';
import { primitiveName } from '../primitives/index.ts';
import { ResolveError } from './errors.ts';

export type PropsOf<K extends PrimitiveKind> = Omit<PrimitivePropsMap[K], 'children'>;

type Entry = readonly [string, unknown];

// children sai antes; os demais são estrutura/identidade do nó e passam intactos.
const NON_RESPONSIVE: ReadonlySet<string> = new Set<NonResponsiveKey>(['children', 'src', 'kind', 'notes']);

const assertWellFormed = (key: string, value: unknown, kind: PrimitiveKind, path: string): void => {
  const problem = responsiveProblemOf(value);
  if (problem === undefined) return;
  throw new ResolveError(`Prop "${key}" de <${primitiveName(kind)}>: ${problem}`, path);
};

const resolveEntry = (entry: Entry, kind: PrimitiveKind, path: string, ctx: ResponsiveContext): Entry => {
  const [key, value] = entry;
  if (NON_RESPONSIVE.has(key)) return entry;
  assertWellFormed(key, value, kind, path);
  return [key, pickResponsive(value, ctx)];
};

/**
 * Props do nó sem children, com cada valor responsivo resolvido para o ctx. O que resolve
 * para undefined some do objeto: o resto do pipeline trata como "autor não escreveu".
 */
export const resolvePropsOf = <K extends PrimitiveKind>(
  element: SlideElement,
  kind: K,
  path: string,
  ctx: ResponsiveContext,
): PropsOf<K> => {
  const { children: _children, ...rest } = element.props;
  const entries = Object.entries(rest)
    .map((entry) => resolveEntry(entry, kind, path, ctx))
    .filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as unknown as PropsOf<K>;
};
