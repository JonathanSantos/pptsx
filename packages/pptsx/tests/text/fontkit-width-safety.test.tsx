import { describe, expect, it } from 'vitest';
import { DEFAULTS, textStyleOf } from '../../src/core/defaults.ts';
import type { PositionedNode, PositionedText, TextMeasureInput } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { fitSlide } from '../../src/fit/index.ts';
import { Deck, Slide, Text } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext } from '../../src/sizes.ts';
import { createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { defineDeck } from '../../src/index.ts';
import { SIZE_16X9, SIZE_4X3 } from '../helpers/nodes.ts';

/**
 * Regressão: TextLayout.width do fontkit = min(linhaMaisLarga / safety, maxWidth).
 * Antes, um Text dimensionado pelo conteúdo recebia a largura exata, era remedido
 * com largura × safety e quebrava a palavra ("Obrigad/o").
 */

const registry = createFontRegistry(DEFAULT_FONTS);
const SAFETIES = [DEFAULTS.textSafety, 0.9, 1] as const;

const input = (content: string, maxWidth: number, size = 60): TextMeasureInput => ({
  content,
  style: textStyleOf({ size, weight: 'bold' }),
  maxWidth,
});

describe('fontkit measurer — width includes the safety slack', () => {
  it.each(SAFETIES)('safety %d: maxWidth Infinity → width = widest / safety', (safety) => {
    const exact = createFontkitMeasurer(registry, { safety: 1 })(input('Obrigado', Infinity));
    const r = createFontkitMeasurer(registry, { safety })(input('Obrigado', Infinity));
    expect(r.lines).toEqual(['Obrigado']);
    expect(r.width).toBeCloseTo(exact.width / safety, 6);
  });

  it('uses DEFAULTS.textSafety when no safety is given', () => {
    const exact = createFontkitMeasurer(registry, { safety: 1 })(input('Obrigado', Infinity));
    const r = createFontkitMeasurer(registry)(input('Obrigado', Infinity));
    expect(r.width).toBeCloseTo(exact.width / DEFAULTS.textSafety, 6);
  });

  it.each(SAFETIES)('safety %d: re-measuring with maxWidth = width gives the same single line', (safety) => {
    const measure = createFontkitMeasurer(registry, { safety });
    for (const content of ['Obrigado', 'Resultados Q3', 'Hello, world', 'W']) {
      const first = measure(input(content, Infinity));
      const again = measure(input(content, first.width));
      expect(again.lines, content).toEqual(first.lines);
      expect(again.lines, content).toHaveLength(1);
      expect(again.height).toBeCloseTo(first.height, 6);
    }
  });

  it.each(SAFETIES)('safety %d: finite maxWidth → width ≤ maxWidth', (safety) => {
    const measure = createFontkitMeasurer(registry, { safety });
    const long = 'Consolidamos a operação em três regiões e reduzimos o tempo médio de entrega';
    for (const maxWidth of [40, 120, 300, 700]) {
      for (const content of ['Obrigado', long]) {
        expect(measure(input(content, maxWidth, 24)).width, `${content} @ ${maxWidth}`).toBeLessThanOrEqual(maxWidth + 1e-9);
      }
    }
  });

  it('a line that exactly fills the break width yields width = maxWidth (clamped)', () => {
    const safety = DEFAULTS.textSafety;
    const exact = createFontkitMeasurer(registry, { safety: 1 })(input('Obrigado', Infinity)).width;
    const maxWidth = exact / safety;
    const r = createFontkitMeasurer(registry, { safety })(input('Obrigado', maxWidth));
    expect(r.lines).toEqual(['Obrigado']);
    expect(r.width).toBeLessThanOrEqual(maxWidth + 1e-9);
  });
});

// ───────────── fit / render: textos centralizados dimensionados pelo conteúdo ─────────────

const env = {
  measureText: createFontkitMeasurer(registry),
  imageSize: () => ({ width: 1, height: 1 }),
};

const centered = (
  <Slide alignItems="center" justifyContent="center" gap={16}>
    <Text fontSize={60} fontWeight="bold">Obrigado</Text>
    <Text fontSize={24}>Até a próxima</Text>
  </Slide>
);

const texts = (nodes: readonly PositionedNode[]): PositionedText[] =>
  nodes.flatMap((n) => (n.kind === 'text' ? [n] : n.kind === 'box' ? texts(n.children) : []));

describe('fitSlide — centered short texts (align/justify center)', () => {
  it.each([SIZE_16X9, SIZE_4X3])('$name: 0 diagnostics and each text on one line', (size) => {
    const slide = resolveDeck(<Deck>{centered}</Deck>, createContext(size)).slides[0]!;
    const result = fitSlide({ slide, slideIndex: 0, size, env });
    expect(result.diagnostics).toEqual([]);
    const positioned = texts(result.slide.children);
    expect(positioned).toHaveLength(2);
    for (const text of positioned) {
      expect(text.text.lines, text.content).toEqual([text.content]);
      expect(text.text.fontSize).toBe(text.props.size);
    }
  });
});

describe('render — centered short texts', () => {
  it('16x9 and 4x3: 0 diagnostics', async () => {
    const deck = defineDeck(() => <Deck>{centered}</Deck>);
    const results = await render(deck, { sizes: ['16x9', '4x3'], preview: false });
    for (const result of results) expect(result.diagnostics, result.size).toEqual([]);
  }, 60_000);
});
