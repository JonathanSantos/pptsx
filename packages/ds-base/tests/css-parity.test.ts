import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, type PositionedNode, type SizePresetName } from 'pptsx';
import charts from '../examples/charts.tsx';
import demo from '../examples/demo.tsx';
import longList from '../examples/long-list.tsx';
import m9 from '../examples/agent-test/m9-deck.tsx';
import showcase from '../examples/showcase.tsx';

/**
 * M11 → M17: a parte do `css-positioned.json` do núcleo que é do DS (demo, long-list, charts, showcase,
 * m9) veio para cá: mesmos nós, frames ±1 pt, mesmo corpo e linhas de texto, mesmos diagnósticos, em
 * 16x9, 4x3 e wide.
 */
interface Node { readonly path: string; readonly kind: string; readonly frame: readonly number[]; readonly fontSize?: number; readonly lines?: number }
interface Size { readonly slides: readonly (readonly Node[])[]; readonly diagnostics: readonly { severity: string; code: string; slide: number; path: string }[] }
const CSS = (JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__/css-positioned.json'), 'utf8')) as { decks: Readonly<Record<string, Readonly<Record<string, Size>>>> }).decks;
const EXAMPLES = resolve(import.meta.dirname, '../examples');

const DECKS = [['demo', demo, EXAMPLES], ['long-list', longList, EXAMPLES], ['charts', charts, EXAMPLES], ['agent-test/m9-deck', m9, join(EXAMPLES, 'agent-test')], ['showcase', showcase, EXAMPLES]] as const;
const SIZES: readonly SizePresetName[] = ['16x9', '4x3', 'wide'];

const flatten = (nodes: readonly PositionedNode[]): readonly PositionedNode[] => nodes.flatMap((n) => [n, ...(n.kind === 'box' ? flatten(n.children) : [])]);
const keyOf = (d: { readonly severity: string; readonly code: string; readonly slide: number; readonly path: string }) => `${d.severity} ${d.code} s${d.slide} ${d.path}`;

describe('decks do ds-base × css-positioned.json', () => {
  it.each(DECKS.flatMap(([name, deck, dir]) => SIZES.map((size) => [name, size, deck, dir] as const)))('%s %s', async (name, size, deck, dir) => {
    const expected = CSS[name]![size]!;
    const [result] = await render(deck, { sizes: [size], preview: false, includePositioned: true, baseDir: dir });
    const slides = result!.positioned!.slides;
    expect(slides).toHaveLength(expected.slides.length);
    slides.forEach((slide, index) => {
      const before = expected.slides[index]!;
      const now = [{ path: slide.path, kind: 'slide', frame: slide.frame } as unknown as PositionedNode, ...flatten(slide.children)];
      expect(now.map((n) => n.path), `slide ${index + 1}`).toEqual(before.map((n) => n.path));
      before.forEach((node, i) => {
        const current = now[i]!;
        const f = current.frame;
        [f.x, f.y, f.width, f.height].forEach((value, k) => expect(Math.abs(value - node.frame[k]!), `${node.path}`).toBeLessThanOrEqual(1));
        if (node.fontSize !== undefined && current.kind === 'text') {
          expect(current.text.fontSize, node.path).toBe(node.fontSize);
          expect(current.text.lines.length, node.path).toBe(node.lines);
        }
      });
    });
    expect(result!.diagnostics.map(keyOf)).toEqual(expected.diagnostics.map(keyOf));
  }, 120_000);
});
