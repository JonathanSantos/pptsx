import { fileURLToPath } from 'node:url';
import { fitDeck as engineFitDeck } from '../../../src/fit/index.ts';
import { resolveDeck as engineResolve } from '../../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../../src/sizes.ts';
import { createFontkitMeasurer, createFontRegistry } from '../../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../../src/fonts/index.ts';
import type { DeckDefinition, PositionedNode as EngineNode, PositionedSlide as EngineSlide, Rect, SizeSpec } from '../../../src/core/types.ts';
import { createEnv, fitSize } from '../render.ts';
import { POC_DEFAULTS } from '../defaults.ts';
import type { Diagnostic, LayoutEnv, PositionedNode, PositionedSlide } from '../types.ts';

export const EXAMPLES_DIR = fileURLToPath(new URL('../../../examples/', import.meta.url));
export const POC_EXAMPLES_DIR = fileURLToPath(new URL('../examples/', import.meta.url));

export const pocEnv = (baseDir: string = EXAMPLES_DIR): LayoutEnv => createEnv({ baseDir });

export const engineEnv = (baseDir: string = EXAMPLES_DIR) => ({
  ...pocEnv(baseDir),
  measureText: createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS)),
});

type AnyNode = PositionedNode | EngineNode;
type AnySlide = PositionedSlide | EngineSlide;

export const flatten = (nodes: readonly AnyNode[]): AnyNode[] =>
  nodes.flatMap((node) => [node, ...(node.kind === 'box' ? flatten(node.children as readonly AnyNode[]) : [])]);

export const nodesOf = (slide: AnySlide): AnyNode[] => [slide as unknown as AnyNode, ...flatten(slide.children as readonly AnyNode[])];

/** Pós-ajuste: o mesmo par (deck, tamanho) pela PoC e pela engine. */
export const pocFit = (deck: DeckDefinition, size: SizeSpec, baseDir: string = EXAMPLES_DIR) =>
  fitSize(deck, resolveSize(size), pocEnv(baseDir));

export const engineFit = (deck: DeckDefinition, size: SizeSpec, baseDir: string = EXAMPLES_DIR) => {
  const resolved = resolveSize(size);
  const ctx = createContext(resolved);
  return engineFitDeck({ deck: engineResolve(deck(ctx), ctx), size: resolved, env: engineEnv(baseDir) });
};

const KEYS = ['x', 'y', 'width', 'height'] as const;

export const frameDiffs = (path: string, expected: Rect, actual: Rect, tolerance: number = POC_DEFAULTS.frameTolerance): string[] =>
  KEYS.filter((key) => Math.abs(expected[key] - actual[key]) > tolerance).map(
    (key) => `${path}.${key}: ${expected[key].toFixed(2)} → ${actual[key].toFixed(2)}`,
  );

/** Diferenças entre duas árvores posicionadas (mesmos nós, frames ±1 pt, mesmo size/linhas nos Text). */
export const treeDiffs = (expected: AnySlide, actual: AnySlide): string[] => {
  const want = nodesOf(expected);
  const got = nodesOf(actual);
  const shape = want.map((n) => `${n.kind} ${n.path}`).join('\n');
  if (shape !== got.map((n) => `${n.kind} ${n.path}`).join('\n')) return [`estrutura diferente:\n${shape}\n×\n${got.map((n) => `${n.kind} ${n.path}`).join('\n')}`];
  return want.flatMap((node, index) => {
    const other = got[index]!;
    const text =
      node.kind === 'text' && other.kind === 'text' && (node.text.fontSize !== other.text.fontSize || node.text.lines.length !== other.text.lines.length)
        ? [`${node.path}: ${node.text.fontSize}pt/${node.text.lines.length} linhas → ${other.text.fontSize}pt/${other.text.lines.length} linhas`]
        : [];
    return [...frameDiffs(node.path, node.frame, other.frame), ...text];
  });
};

export const codesOf = (diagnostics: readonly Diagnostic[]): string[] =>
  diagnostics.map((d) => `${d.severity} ${d.code} s${d.slide} ${d.path}`);
