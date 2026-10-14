import type { BoxProps, ResolvedNode, ResolvedSlide } from '../core/types.ts';
import { ResolveError } from './errors.ts';

type ResolvedBoxProps = Omit<BoxProps, 'children'>;

/** Decoração absoluta não participa do fluxo, então não tem filhos "a mais" para mandar ao próximo slide. */
export const assertPaginateInFlow = (props: ResolvedBoxProps, path: string): void => {
  if (props.paginate !== true || props.position !== 'absolute') return;
  throw new ResolveError(
    '<Box paginate> não pode ter position="absolute": decoração não pagina; use paginate num Box em fluxo',
    path,
  );
};

/** Paths dos Box com paginate, em ordem de documento (pré-ordem). */
const paginatedPathsOf = (nodes: readonly ResolvedNode[]): readonly string[] =>
  nodes.flatMap((node): readonly string[] => {
    if (node.kind !== 'box') return [];
    const own = node.props.paginate === true ? [node.path] : [];
    return [...own, ...paginatedPathsOf(node.children)];
  });

// O fit divide o slide por um único Box; dois tornariam a divisão ambígua.
export const assertSinglePaginate = (slide: ResolvedSlide): void => {
  const paths = paginatedPathsOf(slide.children);
  const [, second] = paths;
  if (second === undefined) return;
  throw new ResolveError(`Só um <Box paginate> por slide; encontrados ${paths.length}`, second);
};
