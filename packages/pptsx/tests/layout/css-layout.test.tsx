import { describe, expect, it } from 'vitest';
import type { PositionedSlide, PositionedText, SlideElement } from '../../src/core/types.ts';
import { Box, Deck, Shape, Slide, Text, defineDeck } from '../../src/index.ts';
import { byPath, cssFit, fitSlideOf, flatten } from '../helpers/css-fit.tsx';

/**
 * M11 (de poc/css/tests/css-layout.test.tsx): box model, flex completo, block, position e
 * display, com frames calculados à mão (16:9 = 720 × 405 pt).
 */

const slideOf = (slide: SlideElement): PositionedSlide => fitSlideOf(slide);

const frame = (slide: PositionedSlide, path: string) => {
  const { x, y, width, height } = byPath(slide, path).frame;
  return [x, y, width, height].map((v) => Math.round(v * 100) / 100);
};

describe('box model', () => {
  it('margin offsets the item without resizing it', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={50} marginTop={10} marginLeft={20} />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([20, 10, 100, 50]);
  });

  it('border takes space (border-box): content starts after border + padding', () => {
    const slide = slideOf(
      <Slide>
        <Box width={200} height={100} border="4px solid #000" padding={10}>
          <Shape kind="rect" height={10} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([0, 0, 200, 100]);
    expect(frame(slide, 'Slide > Box > Shape')).toEqual([14, 14, 172, 10]);
  });

  it('2- and 4-value shorthands follow CSS order', () => {
    const slide = slideOf(
      <Slide padding="10 20">
        <Box height={10} margin="1 2 3 4" />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([24, 11, 720 - 40 - 6, 10]);
  });

  it('marginTop wins over margin regardless of key order', () => {
    const slide = slideOf(
      <Slide>
        <Box height={10} style={{ marginTop: 30, margin: 5 }} />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([5, 30, 710, 10]);
  });
});

describe('margin auto', () => {
  it('centers horizontally in a column', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={10} margin="0 auto" />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([310, 0, 100, 10]);
  });

  it('marginTop auto pushes the footer to the bottom', () => {
    const slide = slideOf(
      <Slide padding={40}>
        <Text fontSize={20}>Título</Text>
        <Text fontSize={12} marginTop="auto">
          Fonte: plataforma
        </Text>
      </Slide>,
    );
    const footer = byPath(slide, 'Slide > Text[1]') as PositionedText;
    expect(footer.frame.y + footer.frame.height).toBeCloseTo(405 - 40, 5);
  });

  it('marginLeft auto pushes the item right in a row', () => {
    const slide = slideOf(
      <Slide>
        <Box display="flex" height={20}>
          <Box width={50} />
          <Box width={50} marginLeft="auto" />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([670, 0, 50, 20]);
  });
});

describe('flex', () => {
  it('explicit display="flex" is row; Box without display stays column', () => {
    const slide = slideOf(
      <Slide>
        <Box display="flex">
          <Box width={10} height={10} />
          <Box width={10} height={10} />
        </Box>
        <Box>
          <Box width={10} height={10} />
          <Box width={10} height={10} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box[0] > Box[1]')).toEqual([10, 0, 10, 10]);
    expect(frame(slide, 'Slide > Box[1] > Box[1]')).toEqual([0, 20, 10, 10]);
  });

  it('flexWrap wraps lines; gap applies to rows and columns', () => {
    const slide = slideOf(
      <Slide>
        <Box display="flex" flexWrap="wrap" gap={10} width={300} alignItems="flex-start">
          {[0, 1, 2, 3, 4].map((i) => (
            <Box key={i} width={100} height={20} />
          ))}
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([110, 0, 100, 20]);
    expect(frame(slide, 'Slide > Box > Box[2]')).toEqual([0, 30, 100, 20]);
    expect(frame(slide, 'Slide > Box > Box[4]')).toEqual([0, 60, 100, 20]);
  });

  it('flex: n shares free space; flexBasis sets the base', () => {
    const slide = slideOf(
      <Slide>
        <Box display="flex" width={300} height={10}>
          <Box flex={1} />
          <Box flex={2} />
          <Box flexBasis={60} flexShrink={0} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[0]')).toEqual([0, 0, 80, 10]);
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([80, 0, 160, 10]);
    expect(frame(slide, 'Slide > Box > Box[2]')).toEqual([240, 0, 60, 10]);
  });

  it('order changes flow position, not the path', () => {
    const slide = slideOf(
      <Slide>
        <Box display="flex" height={10}>
          <Box width={10} />
          <Box width={20} order={-1} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([0, 0, 20, 10]);
    expect(frame(slide, 'Slide > Box > Box[0]')).toEqual([20, 0, 10, 10]);
  });

  it('legacy names (direction, align, justify) are aliases', () => {
    const slide = slideOf(
      <Slide>
        <Box display="flex" justifyContent="space-between" alignItems="center" height={40}>
          <Box width={10} height={10} />
          <Box width={10} height={10} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([710, 15, 10, 10]);
  });
});

describe('block', () => {
  it('sibling vertical margins collapse (largest wins)', () => {
    const slide = slideOf(
      <Slide>
        <Box display="block">
          <Box height={10} marginBottom={20} />
          <Box height={10} marginTop={30} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([0, 40, 720, 10]);
  });

  it('flex margins do not collapse (they add up)', () => {
    const slide = slideOf(
      <Slide>
        <Box>
          <Box height={10} marginBottom={20} />
          <Box height={10} marginTop={30} />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([0, 60, 720, 10]);
  });
});

describe('position and display', () => {
  it('relative offsets without moving siblings', () => {
    const slide = slideOf(
      <Slide>
        <Box height={10} position="relative" top={5} left={7} />
        <Box height={10} />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box[0]')).toEqual([7, 5, 720, 10]);
    expect(frame(slide, 'Slide > Box[1]')).toEqual([0, 10, 720, 10]);
  });

  it('static ignores top/left', () => {
    const slide = slideOf(
      <Slide>
        <Box height={10} top={5} left={7} />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([0, 0, 720, 10]);
  });

  it('absolute with inset', () => {
    const slide = slideOf(
      <Slide>
        <Box position="absolute" inset="10 20 30 40" />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([40, 10, 720 - 60, 405 - 40]);
  });

  it('display none prunes the node; siblings keep their paths', () => {
    const slide = slideOf(
      <Slide>
        <Box height={10} display="none" />
        <Box height={10} />
      </Slide>,
    );
    expect(flatten(slide.children).map((n) => n.path)).toEqual(['Slide > Box[1]']);
    expect(frame(slide, 'Slide > Box[1]')).toEqual([0, 0, 720, 10]);
  });

  it('responsive display none hides per breakpoint', () => {
    const deck = defineDeck(() => (
      <Deck>
        <Slide>
          <Box height={10} display={{ base: 'flex', tall: 'none' }} />
        </Slide>
      </Deck>
    ));
    expect(cssFit(deck, '16x9').positioned.slides[0]!.children).toHaveLength(1);
    expect(cssFit(deck, '4x3').positioned.slides[0]!.children).toHaveLength(0);
  });

  it('transform translate offsets after layout', () => {
    const slide = slideOf(
      <Slide>
        <Box height={10} transform="translate(12px, 8px)" />
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box')).toEqual([12, 8, 720, 10]);
  });
});

describe('text: inheritance and new properties', () => {
  it('fontSize/color/fontWeight inherit from Slide and Box; Text overrides', () => {
    const slide = slideOf(
      <Slide fontSize={20} color="#112233" fontFamily="Arial">
        <Box fontWeight="bold">
          <Text>Herdado</Text>
          <Text fontSize={12} color="#FF0000">
            Próprio
          </Text>
        </Box>
      </Slide>,
    );
    const inherited = byPath(slide, 'Slide > Box > Text[0]') as PositionedText;
    const own = byPath(slide, 'Slide > Box > Text[1]') as PositionedText;
    expect(inherited.props).toMatchObject({ size: 20, color: '#112233', weight: 'bold', font: 'Arial' });
    expect(inherited.runs[0]).toMatchObject({ weight: 'bold', color: '#112233' });
    expect(own.props).toMatchObject({ size: 12, color: '#FF0000', weight: 'bold' });
  });

  it('textTransform changes the text before measuring', () => {
    const slide = slideOf(
      <Slide textTransform="uppercase">
        <Text>olá mundo</Text>
      </Slide>,
    );
    expect((byPath(slide, 'Slide > Text') as PositionedText).content).toBe('OLÁ MUNDO');
  });

  it('letterSpacing is measured', () => {
    const slide = slideOf(
      <Slide alignItems="flex-start">
        <Text fontSize={20}>abcdef</Text>
        <Text fontSize={20} letterSpacing={2}>
          abcdef
        </Text>
      </Slide>,
    );
    const plain = byPath(slide, 'Slide > Text[0]') as PositionedText;
    const spaced = byPath(slide, 'Slide > Text[1]') as PositionedText;
    expect(spaced.frame.width - plain.frame.width).toBeCloseTo((6 * 2) / 0.97, 1);
  });

  it('Text padding and border: text wraps in the content area', () => {
    const slide = slideOf(
      <Slide alignItems="flex-start">
        <Text fontSize={14} padding="4 8" border="1px solid #000">
          Tag
        </Text>
      </Slide>,
    );
    const tag = byPath(slide, 'Slide > Text') as PositionedText;
    expect(tag.frame.height).toBeCloseTo(tag.text.height + 8 + 2, 5);
    expect(tag.box.padding).toEqual({ top: 4, right: 8, bottom: 4, left: 8 });
  });
});
