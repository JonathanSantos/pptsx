import { DEFAULTS } from './core/defaults.ts';
import type { ResponsiveContext } from './core/responsive.ts';
import type { Diagnostic, LayoutEnv, PositionedNode, ResolvedDeck, ResolvedNode, SlideElement, SlideSize } from './core/types.ts';
import { contentRectOf, layoutSlide } from './layout/index.ts';
import { containerKeyOf, resolveDeck, type ContainerMeasure, type ContainerMeasures, type ResolveEnv } from './resolve/index.ts';

/**
 * M19: resolve com `<Container>`. Cada passada resolve o deck com as medidas que já existem, faz o layout só dos
 * slides que ainda têm Container sem medida, mede o espaço de cada um e resolve de novo. Slides sem Container não
 * passam por aqui duas vezes: com nada pendente, a 1ª passada já é a final (custo e saída de antes).
 */
export interface ContainersResult {
  readonly deck: ResolvedDeck;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ContainersInput {
  readonly root: SlideElement;
  readonly responsive: ResponsiveContext;
  readonly resolveEnv?: ResolveEnv;
  readonly size: SlideSize;
  readonly layoutEnv: LayoutEnv;
}

/** Menor que isto o espaço é "sem tamanho": o pai depende do conteúdo, que o Container não dá. */
const UNSIZED_PT = 0.5;

const pendingPathsOf = (nodes: readonly ResolvedNode[]): readonly string[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [...(node.container === 'pending' ? [node.path] : []), ...pendingPathsOf(node.children)] : []));

const positionedOf = (nodes: readonly PositionedNode[]): ReadonlyMap<string, PositionedNode> =>
  new Map(nodes.flatMap((node): (readonly [string, PositionedNode])[] => [[node.path, node], ...(node.kind === 'box' ? [...positionedOf(node.children)] : [])]));

const measureOf = (node: PositionedNode): ContainerMeasure => {
  const content = contentRectOf(node.frame, node.box);
  return { frame: { width: node.frame.width, height: node.frame.height }, content: { width: content.width, height: content.height } };
};

const diagnosticOf = (code: 'container-unsized' | 'container-depth', size: SlideSize, slide: number, path: string): Diagnostic =>
  code === 'container-unsized'
    ? {
        severity: 'warning', code, size: size.name, slide, path,
        message: 'O Container recebeu largura ou altura 0: o tamanho dele vem do pai (contenção de tamanho), não do conteúdo. Dê flex, width/height ou ponha-o numa célula de grid com tamanho.',
      }
    : {
        severity: 'error', code, size: size.name, slide, path,
        message: `Containers aninhados além de ${DEFAULTS.containerQuery.maxDepth} níveis: este ficou vazio. Achate a composição ou meça uma vez só no nível de fora.`,
      };

export const resolveWithContainers = ({ root, responsive, resolveEnv, size, layoutEnv }: ContainersInput): ContainersResult => {
  const step = (measures: ContainerMeasures, diagnostics: readonly Diagnostic[], pass: number): ContainersResult => {
    const deck = resolveDeck(root, responsive, resolveEnv, measures);
    const pending = deck.slides.map((slide, index) => ({ index, paths: pendingPathsOf(slide.children) })).filter((entry) => entry.paths.length > 0);
    if (pending.length === 0) return { deck, diagnostics };
    if (pass >= DEFAULTS.containerQuery.maxDepth) {
      const depth = pending.flatMap(({ index, paths }) => paths.map((path) => diagnosticOf('container-depth', size, index + 1, path)));
      return { deck, diagnostics: [...diagnostics, ...depth] };
    }
    const measured = pending.flatMap(({ index, paths }) => {
      const nodes = positionedOf(layoutSlide(deck.slides[index]!, size, layoutEnv).children);
      return paths.flatMap((path) => {
        const node = nodes.get(path);
        return node === undefined ? [] : [{ index, path, measure: measureOf(node) }];
      });
    });
    const unsized = measured
      .filter(({ measure }) => measure.content.width < UNSIZED_PT || measure.content.height < UNSIZED_PT)
      .map(({ index, path }) => diagnosticOf('container-unsized', size, index + 1, path));
    const next = new Map([...measures, ...measured.map(({ index, path, measure }) => [containerKeyOf(index, path), measure] as const)]);
    return step(next, [...diagnostics, ...unsized], pass + 1);
  };
  return step(new Map(), [], 0);
};
