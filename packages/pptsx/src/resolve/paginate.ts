import type { CssStyle, ResolvedNode, ResolvedSlide } from '../core/types.ts';
import { ResolveError } from './errors.ts';

/** M16: a posição vem do CSS (as props do nó não guardam geometria). */
type Position = CssStyle['position'];

/** Decoração absoluta não participa do fluxo, então não tem filhos "a mais" para mandar ao próximo slide. */
export const assertPaginateInFlow = (props: { readonly paginate?: boolean }, position: Position, path: string): void => {
  if (props.paginate !== true || position !== 'absolute') return;
  throw new ResolveError(
    '<Box paginate> não pode ter position="absolute": decoração não pagina; use paginate num Box em fluxo',
    path,
  );
};

interface Paginated {
  readonly path: string;
  readonly kind: 'box' | 'text' | 'table';
}

/** Box, Text (M13) e Table (M14) com paginate, em ordem de documento (pré-ordem). */
const paginatedOf = (nodes: readonly ResolvedNode[]): readonly Paginated[] =>
  nodes.flatMap((node): readonly Paginated[] => {
    if (node.kind === 'text') return node.props.paginate === true ? [{ path: node.path, kind: 'text' }] : [];
    if (node.kind === 'table') return node.props.paginate === true ? [{ path: node.path, kind: 'table' }] : [];
    if (node.kind !== 'box') return [];
    const own: readonly Paginated[] = node.props.paginate === true ? [{ path: node.path, kind: 'box' }] : [];
    return [...own, ...paginatedOf(node.children)];
  });

// O fit divide o slide por um único nó; dois tornariam a divisão ambígua.
export const assertSinglePaginate = (slide: ResolvedSlide): void => {
  const found = paginatedOf(slide.children);
  const [, second] = found;
  if (second === undefined) return;
  const what = found.every((item) => item.kind === 'box') ? '<Box paginate>' : 'nó paginate (<Box paginate>, <Text paginate> ou <Table paginate>)';
  throw new ResolveError(`Só um ${what} por slide; encontrados ${found.length}`, second.path);
};

/** M13: Text paginate em absoluto ou com maxLines não tem para onde continuar. */
export const assertTextPaginate = (props: { readonly paginate?: boolean; readonly maxLines?: number }, position: Position, path: string): void => {
  if (props.paginate !== true) return;
  if (position === 'absolute') throw new ResolveError('<Text paginate> não pode ter position="absolute": só texto em fluxo continua no próximo slide', path);
  if (props.maxLines !== undefined) throw new ResolveError('<Text paginate> não combina com maxLines: o texto continua no próximo slide em vez de ser cortado', path);
};

/** M14: Table paginate em absoluto não tem para onde continuar. */
export const assertTablePaginate = (props: { readonly paginate?: boolean }, position: Position, path: string): void => {
  if (props.paginate !== true || position !== 'absolute') return;
  throw new ResolveError('<Table paginate> não pode ter position="absolute": só tabela em fluxo continua no próximo slide', path);
};
