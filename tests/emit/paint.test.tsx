import { describe, expect, it } from 'vitest';
import type { PositionedSlide, SlideElement } from '../../src/core/types.ts';
import { decorationOf, paintOrderOf, placementOf } from '../../src/emit/index.ts';
import { Box, Shape, Slide, Span, Text } from '../../src/index.ts';
import { slideToSvg } from '../../src/preview/index.ts';
import { EXAMPLES_DIR, cssFit, deckOf, fitSlideOf, slideXmlOf } from '../helpers/css-fit.tsx';

/** M11 (de poc/css/tests/paint-emit.test.tsx): ordem de pintura, decoração da caixa, XML e preview. */

const slideOf = (slide: SlideElement): PositionedSlide => fitSlideOf(slide);
const slideXml = slideXmlOf;

describe('paint order (z-index)', () => {
  it('flow in tree order; positioned after flow; negative z first; positive z last', () => {
    const slide = slideOf(
      <Slide>
        <Shape kind="rect" position="absolute" width={10} height={10} />
        <Box height={10} zIndex={2} />
        <Box height={10} />
        <Shape kind="ellipse" position="absolute" width={10} height={10} zIndex={-1} />
        <Text>texto</Text>
      </Slide>,
    );
    expect(paintOrderOf(slide).map((item) => item.node.path)).toEqual([
      'Slide > Shape[1]',
      'Slide > Box[1]',
      'Slide > Text',
      'Slide > Shape[0]',
      'Slide > Box[0]',
    ]);
  });

  it('a raised node paints its subtree atomically', () => {
    const slide = slideOf(
      <Slide>
        <Box zIndex={1}>
          <Text>a</Text>
        </Box>
        <Box>
          <Text>b</Text>
        </Box>
      </Slide>,
    );
    expect(paintOrderOf(slide).map((item) => item.node.path)).toEqual([
      'Slide > Box[1]',
      'Slide > Box[1] > Text',
      'Slide > Box[0]',
      'Slide > Box[0] > Text',
    ]);
  });

  it('opacity multiplies down the tree; rotate accumulates', () => {
    const slide = slideOf(
      <Slide>
        <Box opacity={0.5} rotate={10} width={100} height={100}>
          <Box opacity={0.5} rotate="5deg" height={10} />
        </Box>
      </Slide>,
    );
    const inner = paintOrderOf(slide).find((item) => item.node.path === 'Slide > Box > Box')!;
    expect(inner.opacity).toBeCloseTo(0.25);
    expect(placementOf(inner.node.frame, inner.rotations).rotate).toBeCloseTo(15);
  });
});

describe('box decoration', () => {
  const itemOf = (slide: PositionedSlide, path: string) => paintOrderOf(slide).find((item) => item.node.path === path)!;

  it('uniform border: one shape inset by width/2 (stroke inside the border-box)', () => {
    const slide = slideOf(
      <Slide>
        <Box width={72} height={72} backgroundColor="#FF0000" border="8px solid #00FF00" />
      </Slide>,
    );
    const { under, over } = decorationOf(slide.children[0]!, itemOf(slide, 'Slide > Box'));
    expect(over).toEqual([]);
    expect(under).toHaveLength(1);
    expect(under[0]!.options).toMatchObject({ x: 4 / 72, y: 4 / 72, w: 64 / 72, h: 64 / 72, line: { width: 8, color: '00FF00' }, fill: { color: 'FF0000' } });
  });

  it('per-side borders: background without line plus one line per side', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={50} backgroundColor="#EEEEEE" borderTop="4px solid #2F6FED" borderBottom="1px dashed #999999" />
      </Slide>,
    );
    const { under, over } = decorationOf(slide.children[0]!, itemOf(slide, 'Slide > Box'));
    expect(under).toHaveLength(1);
    expect(under[0]!.options.line).toBeUndefined();
    expect(over.map((spec) => spec.shape)).toEqual(['line', 'line']);
    expect(over[1]!.options.line).toMatchObject({ dashType: 'dash', width: 1 });
  });

  it('legacy stroke stays a single shape on the frame', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={50} fill="#EEEEEE" stroke="#000000" strokeWidth={2} radius={6} />
      </Slide>,
    );
    const { under } = decorationOf(slide.children[0]!, itemOf(slide, 'Slide > Box'));
    expect(under).toHaveLength(1);
    expect(under[0]).toMatchObject({ shape: 'roundRect', options: { x: 0, y: 0, line: { width: 2 } } });
  });
});

describe('pptx XML', () => {
  it('shadow, rotation, opacity, letterSpacing and text decoration are native', async () => {
    const xml = await slideXml(
      <Slide>
        <Box width={100} height={60} backgroundColor="#FFFFFF" boxShadow="0 4px 12px rgba(0,0,0,0.25)" rotate={15} opacity={0.5} />
        <Text letterSpacing={2} textDecoration="underline">
          Título <Span textDecoration="line-through">riscado</Span>
        </Text>
      </Slide>,
    );
    expect(xml).toContain('<a:outerShdw');
    expect(xml).toMatch(/rot="900000"/);
    expect(xml).toMatch(/<a:alpha val="50000"\/>/);
    expect(xml).toMatch(/spc="200"/);
    expect(xml).toMatch(/u="sng"/);
    expect(xml).toMatch(/strike="sngStrike"/);
  });

  it('z-index changes the shape order in the slide', async () => {
    const xml = await slideXml(
      <Slide>
        <Box height={10} backgroundColor="#111111" zIndex={1} />
        <Box height={10} backgroundColor="#222222" />
      </Slide>,
    );
    expect(xml.indexOf('222222')).toBeLessThan(xml.indexOf('111111'));
  });
});

describe('css-not-emitted', () => {
  it('unsupported property warns with property and path', () => {
    const { diagnostics } = cssFit(
      deckOf(
        <Slide>
          <Box height={10} style={{ filter: 'blur(2px)' }} transform="skewX(10deg)" overflow="hidden" />
          <Box height={10} boxShadow="inset 0 0 4px #000" backgroundColor="#FFFFFF" />
        </Slide>,
      ),
      '16x9',
    );
    const notEmitted = diagnostics.filter((d) => d.code === 'css-not-emitted');
    expect(notEmitted.every((d) => d.severity === 'warning')).toBe(true);
    const messages = notEmitted.map((d) => `${d.path}: ${d.message}`).join('\n');
    expect(messages).toContain('Slide > Box[0]: A propriedade CSS filter');
    expect(messages).toContain('skewX(10deg)');
    expect(messages).toContain('overflow: hidden');
    expect(messages).toContain('Slide > Box[1]: A propriedade CSS boxShadow');
  });

  it('fontWeight other than 400/700 warns it becomes regular/bold', () => {
    const { diagnostics } = cssFit(deckOf(<Slide><Text fontWeight={500}>x</Text></Slide>), '16x9');
    expect(diagnostics.map((d) => d.message).join()).toContain('sai como regular');
  });
});

describe('preview', () => {
  it('draws shadow, side border, rotation and opacity', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={60} backgroundColor="#FFFFFF" boxShadow="0 4px 12px #000" borderLeft="4px solid #2F6FED" rotate={15} opacity={0.5} />
      </Slide>,
    );
    const svg = slideToSvg(slide, { name: '16x9', width: 720, height: 405 }, { widthPx: 320, baseDir: EXAMPLES_DIR });
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('rotate(15');
    expect(svg).toContain('opacity="0.5"');
    expect(svg).toMatch(/<line x1="2" y1="0" x2="2" y2="60"/);
  });
});
