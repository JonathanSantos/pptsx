import type { LayoutEnv, PositionedNode, PositionedSlide, PositionedText } from '../core/types.ts';
import { DEFAULTS } from '../core/defaults.ts';
import { contentRectOf, measureInputOf } from '../layout/index.ts';

/**
 * M13-6: cada SlideNumber recebe o número do deck de saída (depois da paginação) e o total.
 * O frame continua o medido com o pior caso ("88 / 88"); só o texto é remedido nele. Puro.
 */

const labelOf = (format: 'n' | 'n / total', index: number, total: number): string => (format === 'n' ? String(index) : `${index} / ${total}`);

const numberText = (node: PositionedText, index: number, total: number, env: LayoutEnv): PositionedText => {
  if (node.slideNumber === undefined) return node;
  const content = labelOf(node.slideNumber.format, index, total);
  const [first] = node.runs;
  const runs = first === undefined ? node.runs : [{ ...first, text: content }];
  // Largura natural numa linha: o medidor devolve a caixa com a folga do safety (largura / safety).
  const safety = env.textSafety ?? DEFAULTS.textSafety;
  const natural = (text: string): number =>
    env.measureText({ ...measureInputOf({ ...node, content: text, runs: runs.map((run) => ({ ...run, text })) }, Number.POSITIVE_INFINITY), nowrap: true }).width * safety;
  const slideNumber = { ...node.slideNumber, index, total, numberWidth: natural(String(index)), labelWidth: natural(content) };
  const numbered = { ...node, content, runs, slideNumber };
  return { ...numbered, text: env.measureText(measureInputOf(numbered, contentRectOf(node.frame, node.box).width)) };
};

const numberNodes = (nodes: readonly PositionedNode[], index: number, total: number, env: LayoutEnv): readonly PositionedNode[] =>
  nodes.map((node) => {
    if (node.kind === 'text') return numberText(node, index, total, env);
    return node.kind === 'box' ? { ...node, children: numberNodes(node.children, index, total, env) } : node;
  });

export const numberSlides = (slides: readonly PositionedSlide[], env: LayoutEnv): readonly PositionedSlide[] =>
  slides.map((slide, index) => ({ ...slide, children: numberNodes(slide.children, index + 1, slides.length, env) }));
