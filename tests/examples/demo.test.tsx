import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import demo from '../../examples/demo.tsx';
import { render } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { PositionedNode, PositionedSlide, ResolvedDeck, ResolvedNode, SizePresetName } from '../../src/core/types.ts';
import baseline from './__fixtures__/demo-positioned.json' with { type: 'json' };

/** M5: demo.tsx gera 16:9 e 4:3 sem mudar código e sem diagnóstico error. */

const EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url));

const resolvedAt = (name: SizePresetName): ResolvedDeck => {
  const ctx = createContext(resolveSize(name));
  return resolveDeck(demo(ctx), ctx);
};

const pathsOf = (nodes: readonly ResolvedNode[]): string[] =>
  nodes.flatMap((node) => [node.path, ...('children' in node ? pathsOf(node.children) : [])]);

/** Árvore resolvida reduzida a paths por slide (estrutura, sem props). */
const pathTree = (deck: ResolvedDeck): string[][] => deck.slides.map((slide) => [slide.path, ...pathsOf(slide.children)]);

const allPaths = (deck: ResolvedDeck): string[] => pathTree(deck).flat();

describe('examples/demo.tsx — resolved tree', () => {
  it('has 6 slides in 16x9 and 4x3', () => {
    expect(resolvedAt('16x9').slides).toHaveLength(6);
    expect(resolvedAt('4x3').slides).toHaveLength(6);
  });

  it('slide roots are the layouts: cover · content ×3 · closing', () => {
    const roots = resolvedAt('16x9').slides.map((slide) => slide.path);
    expect(roots).toEqual(['CoverLayout', 'ContentLayout', 'ContentLayout', 'ContentLayout', 'ContentLayout', 'ClosingLayout']);
  });

  it('paths name the components (Bullets, TwoColumn, KpiRow, KpiCard)', () => {
    const paths = allPaths(resolvedAt('16x9'));
    for (const name of ['Bullets', 'TwoColumn', 'KpiRow', 'KpiCard']) {
      expect(paths.some((path) => path.split(' > ').some((segment) => segment.replace(/\[\d+\]$/, '') === name)), name).toBe(true);
    }
  });

  it('two-column slide: row in 16x9, column (stacked) in 4x3', () => {
    const twoColumnOf = (name: SizePresetName) => {
      const find = (nodes: readonly ResolvedNode[]): ResolvedNode | undefined =>
        nodes.map((node) => (node.path.endsWith('TwoColumn') ? node : 'children' in node ? find(node.children) : undefined)).find(Boolean);
      return find(resolvedAt(name).slides[2]!.children);
    };
    expect(twoColumnOf('16x9')?.props).toMatchObject({ direction: 'row' });
    expect(twoColumnOf('4x3')?.props).toMatchObject({ direction: 'column' });
  });

  it('snapshot of the resolved path tree in 16x9', () => {
    expect(pathTree(resolvedAt('16x9'))).toMatchSnapshot();
  });

  it('snapshot of the resolved path tree in 4x3', () => {
    expect(pathTree(resolvedAt('4x3'))).toMatchSnapshot();
  });
});

describe('examples/demo.tsx — render', () => {
  it('render() in 16x9 and 4x3 has no error diagnostic', async () => {
    const results = await render(demo, { sizes: ['16x9', '4x3'], preview: false, baseDir: EXAMPLES_DIR });
    expect(results.map((r) => r.size)).toEqual(['16x9', '4x3']);
    for (const result of results) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
    }
  }, 120_000);

  it('render() with preview produces 6 slide PNGs per size', async () => {
    const results = await render(demo, { sizes: ['16x9', '4x3'], preview: { mode: 'native', width: 320 }, baseDir: EXAMPLES_DIR });
    for (const result of results) expect(result.preview?.slides).toHaveLength(6);
  }, 120_000);
});

/**
 * M9: a demo reescrita com props responsivas (M9-D) tem que posicionar igual à de antes.
 * `__fixtures__/demo-positioned.json` foi gerado da demo após o M10-G (Chart nativo no slide 3, Table no slide 5);
 * antes disso, da demo do commit 77c0143 (pré-M9-D), e o M9-D a manteve idêntica:
 * por tamanho, por slide, cada nó em pré-ordem com path, kind, frame (2 casas) e, em Text,
 * fontSize e número de linhas pós-ajuste. Frames comparados com tolerância de 1 pt.
 */
interface BaselineNode {
  readonly path: string;
  readonly kind: string;
  readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly fontSize?: number;
  readonly lines?: number;
}

const BASELINE = baseline as Readonly<Record<string, readonly (readonly BaselineNode[])[]>>;
const FRAME_TOLERANCE_PT = 1;

const flatten = (nodes: readonly PositionedNode[]): PositionedNode[] =>
  nodes.flatMap((n) => [n, ...(n.kind === 'box' ? flatten(n.children) : [])]);

const frameDiffs = (expected: BaselineNode, actual: PositionedNode | PositionedSlide): string[] =>
  (['x', 'y', 'width', 'height'] as const)
    .filter((key) => Math.abs(expected.frame[key] - actual.frame[key]) > FRAME_TOLERANCE_PT)
    .map((key) => `${actual.path}.${key}: ${expected.frame[key]} → ${actual.frame[key]}`);

const textDiffs = (expected: BaselineNode, actual: PositionedNode | PositionedSlide): string[] => {
  if (actual.kind !== 'text') return [];
  const out: string[] = [];
  if (expected.fontSize !== undefined && Math.abs(expected.fontSize - actual.text.fontSize) > FRAME_TOLERANCE_PT) {
    out.push(`${actual.path}.fontSize: ${expected.fontSize} → ${actual.text.fontSize}`);
  }
  if (expected.lines !== undefined && expected.lines !== actual.text.lines.length) {
    out.push(`${actual.path}.lines: ${expected.lines} → ${actual.text.lines.length}`);
  }
  return out;
};

describe('examples/demo.tsx — positioned tree matches the stored baseline (≤ 1 pt)', () => {
  const sizes = Object.keys(BASELINE) as SizePresetName[];

  it('baseline covers 16x9, 4x3 and wide', () => {
    expect(sizes).toEqual(['16x9', '4x3', 'wide']);
  });

  it.each(sizes)('%s: same nodes, frames within 1 pt, same text size and lines', async (size) => {
    const [result] = await render(demo, { sizes: [size], preview: false, includePositioned: true, baseDir: EXAMPLES_DIR });
    const slides = result!.positioned!.slides;
    const expected = BASELINE[size]!;
    expect(slides).toHaveLength(expected.length);
    slides.forEach((slide, i) => {
      const actual = [slide, ...flatten(slide.children)];
      const want = expected[i]!;
      expect(actual.map((n) => `${n.kind} ${n.path}`), `slide ${i + 1}`).toEqual(want.map((n) => `${n.kind} ${n.path}`));
      const diffs = want.flatMap((node, j) => [...frameDiffs(node, actual[j]!), ...textDiffs(node, actual[j]!)]);
      expect(diffs, `slide ${i + 1}`).toEqual([]);
    });
  }, 120_000);
});
