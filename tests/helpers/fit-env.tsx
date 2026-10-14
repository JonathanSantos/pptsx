/**
 * Ambiente real de ajuste (fontkit + Liberation Sans) e leitores da árvore
 * posicionada, compartilhados pelos testes de fit do M6.
 */
import { fitSlide, type FitResult } from '../../src/fit/index.ts';
import type {
  Diagnostic,
  LayoutEnv,
  PositionedNode,
  PositionedSlide,
  PositionedText,
  ResolvedSlide,
  SlideElement,
  SlideSize,
  TextMeasureInput,
  TextMeasurer,
} from '../../src/core/types.ts';
import { textStyleOf } from '../../src/core/defaults.ts';
import { Deck } from '../../src/primitives/index.ts';
import { layoutSlide } from '../../src/layout/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { SIZE_16X9 } from './nodes.ts';

export const realMeasurer: TextMeasurer = createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS));

export const realEnv: LayoutEnv = {
  measureText: realMeasurer,
  imageSize: () => ({ width: 4000, height: 2000 }),
};

/** Ambiente real que registra cada chamada ao medidor (spy). */
export const createSpyEnv = () => {
  const calls: TextMeasureInput[] = [];
  const env: LayoutEnv = {
    ...realEnv,
    measureText: (input) => {
      calls.push(input);
      return realMeasurer(input);
    },
  };
  return { env, calls };
};

export const resolveSlide = (slide: SlideElement): ResolvedSlide => {
  const first = resolveDeck(<Deck>{slide}</Deck>).slides[0];
  if (!first) throw new Error('no slide');
  return first;
};

export const fitWith = (env: LayoutEnv, slide: SlideElement, size: SlideSize = SIZE_16X9): FitResult =>
  fitSlide({ slide: resolveSlide(slide), slideIndex: 0, size, env });

export const fit = (slide: SlideElement, size: SlideSize = SIZE_16X9): FitResult => fitWith(realEnv, slide, size);

/** Layout sem ajuste (tamanhos do autor), para verificar pré-condições sem depender do fit. */
export const layoutOnly = (slide: SlideElement, size: SlideSize = SIZE_16X9): PositionedSlide =>
  layoutSlide(resolveSlide(slide), size, realEnv);

export const allNodes = (slide: PositionedSlide): PositionedNode[] => {
  const walk = (nodes: readonly PositionedNode[]): PositionedNode[] =>
    nodes.flatMap((n) => [n, ...(n.kind === 'box' ? walk(n.children) : [])]);
  return walk(slide.children);
};

export const texts = (slide: PositionedSlide): PositionedText[] =>
  allNodes(slide).filter((n): n is PositionedText => n.kind === 'text');

export const nodeAt = (slide: PositionedSlide, path: string): PositionedNode => {
  const n = allNodes(slide).find((node) => node.path === path);
  if (!n) throw new Error(`no node at ${path}; have ${allNodes(slide).map((node) => node.path).join(', ')}`);
  return n;
};

export const textAt = (slide: PositionedSlide, path: string): PositionedText => {
  const t = texts(slide).find((n) => n.path === path);
  if (!t) throw new Error(`no text at ${path}; have ${texts(slide).map((n) => n.path).join(', ')}`);
  return t;
};

export const byCode = (r: FitResult, code: Diagnostic['code']): Diagnostic[] => r.diagnostics.filter((d) => d.code === code);

export const atPath = (r: FitResult, path: string): Diagnostic[] => r.diagnostics.filter((d) => d.path === path);

export const lineHeightAt = (size: number): number =>
  realMeasurer({ content: 'x', style: textStyleOf({ size }), maxWidth: Infinity }).lineHeight;

/** Demanda de um Text (CONTRACTS §fit "Causa"): quanto quer a mais do que recebeu. */
export const textDemand = (t: PositionedText): number => Math.max(0, t.text.height - t.frame.height);

/** Avalia uma vez, na primeira leitura: um erro do fit falha o teste, não a suíte inteira. */
export const lazy = <T,>(make: () => T): (() => T) => {
  let cached: { value: T } | undefined;
  return () => {
    cached ??= { value: make() };
    return cached.value;
  };
};
