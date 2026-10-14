import { describe, expect, it } from 'vitest';
import type { PositionedNode, PositionedSlide, PositionedText, SlideElement } from '../../src/core/types.ts';
import { Box, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { fit, layoutOnly } from '../helpers/fit-env.tsx';
import { child } from '../helpers/positioned.ts';

/**
 * M8-C: align="baseline" (e alignSelf) numa row alinha pela baseline da 1ª linha
 * de texto. Text → text.ascent; Box → baseline do 1º filho em fluxo; Image/Shape →
 * base do frame. Em column, baseline equivale a start.
 */

const TOL = 0.05;

const asText = (node: PositionedNode): PositionedText => {
  if (node.kind !== 'text') throw new Error(`expected text, got ${node.kind}`);
  return node;
};

const textBaseline = (node: PositionedNode): number => {
  const t = asText(node);
  return t.frame.y + t.text.ascent;
};

const bottom = (node: PositionedNode): number => node.frame.y + node.frame.height;

const rowOf = (slide: SlideElement): PositionedSlide => layoutOnly(slide);

describe('layout — align="baseline" in a row', () => {
  it('Shape 8×8 + Text 24 pt: the shape bottom sits on the text baseline', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={6}>
          <Shape kind="ellipse" width={8} height={8} fill="#000000" />
          <Text size={24}>Receita</Text>
        </Box>
      </Slide>,
    );
    const shape = child(slide, 0, 0);
    const text = child(slide, 0, 1);
    expect(Math.abs(bottom(shape) - textBaseline(text))).toBeLessThanOrEqual(TOL);
    // A baseline não é a base nem o topo do texto: o alinhamento é real.
    expect(shape.frame.y).toBeGreaterThan(text.frame.y + 1);
    expect(bottom(shape)).toBeLessThan(bottom(text) - 1);
  });

  it('alignSelf="baseline" on the children does the same', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="start" gap={6}>
          <Shape kind="rect" width={8} height={8} alignSelf="baseline" />
          <Text size={24} alignSelf="baseline">
            Receita
          </Text>
        </Box>
      </Slide>,
    );
    expect(Math.abs(bottom(child(slide, 0, 0)) - textBaseline(child(slide, 0, 1)))).toBeLessThanOrEqual(TOL);
  });

  it('two Texts of different sizes share the baseline', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={6}>
          <Text size={12}>pequeno</Text>
          <Text size={36}>Grande</Text>
        </Box>
      </Slide>,
    );
    expect(Math.abs(textBaseline(child(slide, 0, 0)) - textBaseline(child(slide, 0, 1)))).toBeLessThanOrEqual(TOL);
  });

  it('a multi-line Text aligns by its first line', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={6}>
          <Shape kind="ellipse" width={8} height={8} />
          <Text size={24} width={120}>
            uma frase que quebra em várias linhas
          </Text>
        </Box>
      </Slide>,
    );
    const text = asText(child(slide, 0, 1));
    expect(text.text.lines.length).toBeGreaterThan(1);
    expect(Math.abs(bottom(child(slide, 0, 0)) - textBaseline(text))).toBeLessThanOrEqual(TOL);
  });

  it('a Box with a Text inside aligns by the baseline of its first child', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={6}>
          <Shape kind="rect" width={8} height={8} />
          <Box padding={{ top: 10 }}>
            <Text size={24}>Dentro</Text>
            <Text size={12}>segunda</Text>
          </Box>
        </Box>
      </Slide>,
    );
    const inner = child(slide, 0, 1, 0);
    expect(Math.abs(bottom(child(slide, 0, 0)) - textBaseline(inner))).toBeLessThanOrEqual(TOL);
  });

  it('an Image aligns by its bottom edge', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={6}>
          <Image src="x.png" width={40} height={20} />
          <Text size={24}>Legenda</Text>
        </Box>
      </Slide>,
    );
    expect(Math.abs(bottom(child(slide, 0, 0)) - textBaseline(child(slide, 0, 1)))).toBeLessThanOrEqual(TOL);
  });

  it('keeps the Text measured as usual (frame height = text height)', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="row" align="baseline">
          <Shape kind="rect" width={8} height={8} />
          <Text size={24}>Receita</Text>
        </Box>
      </Slide>,
    );
    const text = asText(child(slide, 0, 1));
    expect(text.frame.height).toBeCloseTo(text.text.height, 3);
  });
});

describe('layout — align="baseline" in a column behaves as start', () => {
  const column = (align: 'baseline' | 'start') => (
    <Slide padding={40}>
      <Box direction="column" align={align}>
        <Shape kind="rect" width={8} height={8} />
        <Text size={24}>Receita</Text>
      </Box>
    </Slide>
  );

  it('same frames as align="start"', () => {
    const frames = (slide: PositionedSlide) => [child(slide, 0, 0).frame, child(slide, 0, 1).frame];
    expect(frames(rowOf(column('baseline')))).toEqual(frames(rowOf(column('start'))));
  });

  it('alignSelf="baseline" in a column is start too', () => {
    const slide = rowOf(
      <Slide padding={40}>
        <Box direction="column">
          <Text size={24} alignSelf="baseline">
            curto
          </Text>
        </Box>
      </Slide>,
    );
    const text = asText(child(slide, 0, 0));
    expect(text.frame.x).toBeCloseTo(40, 3);
    expect(text.frame.width).toBeLessThan(640 - 1);
  });
});

describe('layout — baseline row keeps the wrapped Text height (M8)', () => {
  const PHRASE = 'Receita líquida do trimestre subiu muito';
  const GAP = 6;

  /** Altura preservada, baselines coincidentes e nenhum diagnóstico no fit. */
  const expectPreserved = (slide: SlideElement, texts: readonly (readonly number[])[]) => {
    const positioned = layoutOnly(slide);
    const shape = child(positioned, 0, 0);
    const row = child(positioned, 0);
    texts.forEach((indices) => {
      const text = asText(child(positioned, ...indices));
      expect(text.text.lines, `lines of ${text.path}`).toHaveLength(2);
      expect(Math.abs(text.frame.height - 2 * text.text.lineHeight), `height of ${text.path}`).toBeLessThanOrEqual(TOL);
      expect(Math.abs(bottom(shape) - textBaseline(text)), `baseline of ${text.path}`).toBeLessThanOrEqual(TOL);
      expect(row.frame.height).toBeGreaterThanOrEqual(text.frame.height - TOL);
    });
    expect(fit(slide).diagnostics).toEqual([]);
    return positioned;
  };

  it('Shape shrink 0 + Text grow 1: Text takes the rest of the row with 2 lines of height', () => {
    const slide = (
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={GAP} width={300}>
          <Shape kind="ellipse" width={8} height={8} shrink={0} />
          <Text size={20} grow={1}>
            {PHRASE}
          </Text>
        </Box>
      </Slide>
    );
    const positioned = expectPreserved(slide, [[0, 1]]);
    const text = asText(child(positioned, 0, 1));
    expect(text.frame.width).toBeCloseTo(300 - 8 - GAP, 2);
    expect(Math.abs(child(positioned, 0).frame.height - text.frame.height)).toBeLessThanOrEqual(TOL);
  });

  it('variant: Text with width={300}', () => {
    expectPreserved(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={GAP} width={500}>
          <Shape kind="ellipse" width={8} height={8} shrink={0} />
          <Text size={20} width={300}>
            {PHRASE}
          </Text>
        </Box>
      </Slide>,
      [[0, 1]],
    );
  });

  it('variant: two Texts with grow={1}', () => {
    expectPreserved(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={GAP} width={500}>
          <Shape kind="ellipse" width={8} height={8} shrink={0} />
          <Text size={20} grow={1}>
            {PHRASE}
          </Text>
          <Text size={20} grow={1}>
            {PHRASE}
          </Text>
        </Box>
      </Slide>,
      [
        [0, 1],
        [0, 2],
      ],
    );
  });

  it('variant: <Box grow={1}><Text/></Box>', () => {
    expectPreserved(
      <Slide padding={40}>
        <Box direction="row" align="baseline" gap={GAP} width={300}>
          <Shape kind="ellipse" width={8} height={8} shrink={0} />
          <Box grow={1}>
            <Text size={20}>{PHRASE}</Text>
          </Box>
        </Box>
      </Slide>,
      [[0, 1, 0]],
    );
  });
});
