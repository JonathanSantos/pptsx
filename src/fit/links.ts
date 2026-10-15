import type { Diagnostic, PositionedNode, PositionedSlide, PositionedText } from '../core/types.ts';

/**
 * M13: links internos (`slide:N`, N = slide do autor) traduzidos para o deck de saída depois da
 * paginação: apontam para a 1ª parte do slide N. N fora do deck → link-target-missing (error) e o
 * link sai do nó. URLs passam intactas. Puro.
 */

const SLIDE = /^slide:(\d+)$/;

type Translate = (href: string) => string | undefined;

interface Linked<T> {
  readonly value: T;
  readonly missing: readonly string[];
}

const translateHref = (href: string | undefined, translate: Translate): Linked<string | undefined> => {
  if (href === undefined) return { value: undefined, missing: [] };
  const translated = translate(href);
  return translated === undefined ? { value: undefined, missing: [href] } : { value: translated, missing: [] };
};

const withHref = <T extends { readonly href?: string }>(item: T, href: string | undefined): T => {
  const { href: _old, ...rest } = item;
  return (href === undefined ? rest : { ...rest, href }) as T;
};

const linkText = (node: PositionedText, translate: Translate): Linked<PositionedText> => {
  const runs = node.runs.map((run) => translateHref(run.href, translate));
  const own = translateHref(node.props.href, translate);
  return {
    value: { ...node, props: withHref(node.props, own.value), runs: node.runs.map((run, index) => withHref(run, runs[index]!.value)) },
    missing: [...own.missing, ...runs.flatMap((run) => run.missing)],
  };
};

interface LinkedNodes {
  readonly nodes: readonly PositionedNode[];
  readonly problems: readonly { readonly path: string; readonly href: string }[];
}

const linkNodes = (nodes: readonly PositionedNode[], translate: Translate): LinkedNodes =>
  nodes.reduce<LinkedNodes>(
    (acc, node) => {
      if (node.kind === 'text') {
        const linked = linkText(node, translate);
        return { nodes: [...acc.nodes, linked.value], problems: [...acc.problems, ...[...new Set(linked.missing)].map((href) => ({ path: node.path, href }))] };
      }
      if (node.kind === 'box') {
        const children = linkNodes(node.children, translate);
        const own = translateHref(node.props.href, translate);
        const box = { ...node, props: withHref(node.props, own.value), children: children.nodes };
        return { nodes: [...acc.nodes, box], problems: [...acc.problems, ...own.missing.map((href) => ({ path: node.path, href })), ...children.problems] };
      }
      if (node.kind === 'image') {
        const own = translateHref(node.props.href, translate);
        return { nodes: [...acc.nodes, { ...node, props: withHref(node.props, own.value) }], problems: [...acc.problems, ...own.missing.map((href) => ({ path: node.path, href }))] };
      }
      return { ...acc, nodes: [...acc.nodes, node] };
    },
    { nodes: [], problems: [] },
  );

const linkMissing = (size: string, slide: number, authorSlides: number, problem: { readonly path: string; readonly href: string }): Diagnostic => ({
  severity: 'error',
  code: 'link-target-missing',
  size,
  slide,
  path: problem.path,
  message: `O link "${problem.href}" aponta para um slide que não existe: o deck tem ${authorSlides} slide(s). O link não foi gravado. Use "slide:N" com N de 1 a ${authorSlides} (o número do slide no seu <Deck>, antes da paginação).`,
});

export interface LinkedDeck {
  readonly slides: readonly PositionedSlide[];
  readonly diagnostics: readonly Diagnostic[];
}

/** `slides` = deck de saída; `authorSlides` = quantos slides o <Deck> do autor tem. */
export const linkDeck = (slides: readonly PositionedSlide[], authorSlides: number, size: string): LinkedDeck => {
  const firstOutput = new Map<number, number>();
  slides.forEach((slide, index) => {
    if (!firstOutput.has(slide.sourceSlide)) firstOutput.set(slide.sourceSlide, index + 1);
  });
  const translate: Translate = (href) => {
    const match = SLIDE.exec(href);
    if (match === null) return href;
    const output = firstOutput.get(Number(match[1]));
    return output === undefined ? undefined : `slide:${output}`;
  };
  const linked = slides.map((slide) => linkNodes(slide.children, translate));
  return {
    slides: slides.map((slide, index) => ({ ...slide, children: linked[index]!.nodes })),
    diagnostics: linked.flatMap((result, index) => result.problems.map((problem) => linkMissing(size, index + 1, authorSlides, problem))),
  };
};
