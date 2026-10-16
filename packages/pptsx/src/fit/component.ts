import type { Diagnostic, PositionedNode, PositionedSlide } from '../core/types.ts';

/**
 * 1.0.5: cada diagnóstico de um nó dentro de uma instância de componente do autor ganha
 * `data.component` = o `source` (`<Nome prop=valor … />`) da instância mais próxima (o nó ou um
 * ancestral). Roda antes do agrupamento, que preserva `data` do pior membro.
 */

const collect = (node: PositionedNode, inherited: string | undefined, into: Map<string, string>): void => {
  const source = node.source ?? inherited;
  if (source !== undefined) into.set(node.path, source);
  if (node.kind !== 'box') return;
  node.children.forEach((child) => collect(child, source, into));
};

/** path → source do componente mais próximo, para todo nó do slide dentro de algum componente. */
export const componentSourcesOf = (slide: PositionedSlide): ReadonlyMap<string, string> => {
  const sources = new Map<string, string>();
  if (slide.source !== undefined) sources.set(slide.path, slide.source);
  slide.children.forEach((child) => collect(child, slide.source, sources));
  return sources;
};

export const attributeComponents = (diagnostics: readonly Diagnostic[], slide: PositionedSlide): readonly Diagnostic[] => {
  const sources = componentSourcesOf(slide);
  if (sources.size === 0) return diagnostics;
  return diagnostics.map((diagnostic) => {
    const component = sources.get(diagnostic.path);
    if (component === undefined || diagnostic.data?.component !== undefined) return diagnostic;
    return { ...diagnostic, data: { ...diagnostic.data, component } };
  });
};
