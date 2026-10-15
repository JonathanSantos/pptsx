import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render, type DeckDefinition, type PositionedNode, type PptsxConfig } from 'pptsx';

/**
 * M17-3: os decks que saíram do núcleo, reconstruídos aqui só com a API pública de pptsx e do ds-kit,
 * têm os mesmos nós e frames (±1 pt) que tinham no núcleo antes da extração
 * (`__fixtures__/decks-positioned.json`, gravado no commit anterior à mudança).
 */
type Frame = readonly [string, number, number, number, number];
type Baseline = Readonly<Record<string, Readonly<Record<string, readonly { readonly sourceSlide: number; readonly nodes: readonly Frame[] }[]>>>>;

const EXAMPLES = resolve(import.meta.dirname, '../examples');
const BASELINE = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__/decks-positioned.json'), 'utf8')) as Baseline;
const TOLERANCE = 1;

const round = (value: number) => Math.round(value * 100) / 100;
const framesOf = (nodes: readonly PositionedNode[]): readonly Frame[] =>
  nodes.flatMap((n) => [[n.path, round(n.frame.x), round(n.frame.y), round(n.frame.width), round(n.frame.height)] as Frame, ...(n.kind === 'box' ? framesOf(n.children) : [])]);

/** A config da pasta do deck (texto/ e arquivo/ têm), com as fontes relativas a ela — como a CLI faz. */
const configOf = async (dir: string): Promise<PptsxConfig> => {
  const file = join(dir, 'pptsx.config.ts');
  if (dir === EXAMPLES || !existsSync(file)) return {};
  const config = ((await import(pathToFileURL(file).href)) as { default: PptsxConfig }).default;
  return { ...config, ...(config.fonts ? { fonts: config.fonts.map((face) => (face.file === undefined || isAbsolute(face.file) ? face : { ...face, file: resolve(dir, face.file) })) } : {}) };
};

describe('decks do ds-base × fixture de antes da extração', () => {
  it.each(Object.keys(BASELINE))('%s', async (deck) => {
    const file = join(EXAMPLES, deck);
    const dir = dirname(file);
    const config = await configOf(dir);
    const definition = ((await import(pathToFileURL(file).href)) as { default: DeckDefinition }).default;
    const results = await render(definition, { sizes: ['16x9', '4x3'], fonts: config.fonts, ...(config.theme ? { theme: config.theme } : {}), preview: false, includePositioned: true, baseDir: dir });
    results.forEach((result) => {
      const expected = BASELINE[deck]![result.size]!;
      const slides = result.positioned!.slides;
      expect(slides.map((s) => s.sourceSlide), `${result.size}: slides`).toEqual(expected.map((s) => s.sourceSlide));
      slides.forEach((slide, index) => {
        const now = framesOf(slide.children);
        const before = expected[index]!.nodes;
        expect(now.map(([path]) => path), `${result.size} slide ${index + 1}: paths`).toEqual(before.map(([path]) => path));
        before.forEach(([path, ...frame], i) => frame.forEach((value, k) => {
          const diff = Math.abs(value - (now[i]![k + 1] as number));
          expect(diff, `${result.size} slide ${index + 1} ${path}`).toBeLessThanOrEqual(TOLERANCE);
        }));
      });
    });
  }, 120_000);
});
