import { pickResponsive, responsiveProblemOf } from '../core/responsive.ts';
import type { ResponsiveContext } from '../core/responsive.ts';
import type { NonResponsiveKey, PrimitiveKind, SlideElement } from '../core/types.ts';
import { primitiveName } from '../primitives/index.ts';
import { ResolveError } from './errors.ts';

/** Props do autor já com valores concretos (nomes CSS, antigos ou da primitiva; ainda não normalizadas). */
export type RawProps = Readonly<Record<string, unknown>>;

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

const resolveEntries = (record: RawProps, kind: PrimitiveKind, path: string, ctx: ResponsiveContext): RawProps =>
  Object.fromEntries(
    Object.entries(record)
      .map((entry) => resolveEntry(entry, kind, path, ctx))
      .filter(([, value]) => value !== undefined),
  );

const isRecord = (value: unknown): value is RawProps => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Props do nó sem children, com cada valor responsivo resolvido para o ctx, inclusive dentro
 * de `style`. O que resolve para undefined some do objeto: o resto do pipeline trata como
 * "autor não escreveu".
 */
export const resolvePropsOf = (element: SlideElement, kind: PrimitiveKind, path: string, ctx: ResponsiveContext): RawProps => {
  const { children: _children, ...rest } = element.props as RawProps;
  const props = resolveEntries(rest, kind, path, ctx);
  const { style } = props;
  if (!isRecord(style)) return props;
  return { ...props, style: resolveEntries(style, kind, path, ctx) };
};
