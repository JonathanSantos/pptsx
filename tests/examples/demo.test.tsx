import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import demo from '../../examples/demo.tsx';
import { render } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { ResolvedDeck, ResolvedNode, SizePresetName } from '../../src/core/types.ts';
import cssBaseline from './__fixtures__/css-positioned.json' with { type: 'json' };
import { slideDiffs, type BaselineNode } from '../helpers/css-fit.tsx';

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

  // M11-F: TwoColumn é grid; `stacked={{ base: false, tall: true }}` vira uma coluna em 4x3.
  it('two-column slide: two grid columns in 16x9, one (stacked) in 4x3', () => {
    const twoColumnOf = (name: SizePresetName) => {
      const find = (nodes: readonly ResolvedNode[]): ResolvedNode | undefined =>
        nodes.map((node) => (node.path.endsWith('TwoColumn') ? node : 'children' in node ? find(node.children) : undefined)).find(Boolean);
      return find(resolvedAt(name).slides[2]!.children);
    };
    const tracksOf = (name: SizePresetName) => twoColumnOf(name)?.css.gridTemplateColumns?.match(/minmax\([^)]*\)/g) ?? [];
    expect(twoColumnOf('16x9')?.css.display).toBe('grid');
    expect(tracksOf('16x9')).toHaveLength(2);
    expect(twoColumnOf('4x3')?.css.display).toBe('grid');
    expect(tracksOf('4x3')).toEqual(['minmax(0, 1fr)']);
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
 * M11: a demo em CSS (M11-F) pelo `render()` × `__fixtures__/css-positioned.json` (a referência
 * de posições dos decks em CSS; ver css-parity.test.tsx). A demo com as props antigas continua
 * comparada com `demo-positioned.json` (M9/M10) em engine-parity.test.tsx, pela cópia em legacy/.
 */
type CssSize = { readonly slides: readonly (readonly BaselineNode[])[] };
const BASELINE = (cssBaseline as unknown as { readonly decks: Readonly<Record<string, Readonly<Record<string, CssSize>>>> }).decks.demo!;

describe('examples/demo.tsx — positioned tree matches the stored baseline (≤ 1 pt)', () => {
  const sizes = Object.keys(BASELINE) as SizePresetName[];

  it('baseline covers 16x9, 4x3 and wide', () => {
    expect(sizes).toEqual(['16x9', '4x3', 'wide']);
  });

  it.each(sizes)('%s: same nodes, frames within 1 pt, same text size and lines', async (size) => {
    const [result] = await render(demo, { sizes: [size], preview: false, includePositioned: true, baseDir: EXAMPLES_DIR });
    const slides = result!.positioned!.slides;
    const expected = BASELINE[size]!.slides;
    expect(slides).toHaveLength(expected.length);
    slides.forEach((slide, i) => expect(slideDiffs(slide, expected[i]!), `slide ${i + 1}`).toEqual([]));
  }, 120_000);
});
