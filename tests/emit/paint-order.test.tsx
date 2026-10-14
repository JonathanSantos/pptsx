import { describe, expect, it } from 'vitest';
import type { SlideElement } from '../../src/core/types.ts';
import { paintOrderOf } from '../../src/emit/index.ts';
import { Box, Shape, Slide, Text } from '../../src/index.ts';
import { slideToSvg } from '../../src/preview/index.ts';
import { EXAMPLES_DIR, fitSlideOf, slideXmlOf } from '../helpers/css-fit.tsx';

/**
 * M11 (decisão nº 1): ordem de pintura pela regra do browser. Decoração absoluta sem zIndex
 * pinta POR CIMA do fluxo (antes do M11 pintava atrás); com zIndex={-1}, atrás. Opacidade e
 * rotação descem para a subárvore.
 */

const FLOW = '#111111';
const DECORATION = '#EE0000';

const cover = (zIndex?: number): SlideElement => (
  <Slide>
    <Shape kind="ellipse" position="absolute" left={0} top={0} width={200} height={200} fill={DECORATION} {...(zIndex === undefined ? {} : { zIndex })} />
    <Box height={100} backgroundColor={FLOW}>
      <Text>Título</Text>
    </Box>
  </Slide>
);

const svgOf = (slide: SlideElement): string =>
  slideToSvg(fitSlideOf(slide), { name: '16x9', width: 720, height: 405 }, { widthPx: 320, baseDir: EXAMPLES_DIR });

const hex = (color: string): string => color.slice(1);

describe('absolute decoration without zIndex', () => {
  it('paints after the flow', () => {
    expect(paintOrderOf(fitSlideOf(cover())).map((item) => item.node.path)).toEqual(['Slide > Box', 'Slide > Box > Text', 'Slide > Shape']);
  });

  it('comes after the flow in the slide XML and in the preview', async () => {
    const xml = await slideXmlOf(cover());
    expect(xml.indexOf(hex(DECORATION))).toBeGreaterThan(xml.indexOf(hex(FLOW)));
    const svg = svgOf(cover()).toUpperCase();
    expect(svg.indexOf(DECORATION)).toBeGreaterThan(svg.indexOf(FLOW));
  });
});

describe('absolute decoration with zIndex={-1}', () => {
  it('paints before the flow', () => {
    expect(paintOrderOf(fitSlideOf(cover(-1))).map((item) => item.node.path)).toEqual(['Slide > Shape', 'Slide > Box', 'Slide > Box > Text']);
  });

  it('comes before the flow in the slide XML and in the preview', async () => {
    const xml = await slideXmlOf(cover(-1));
    expect(xml.indexOf(hex(DECORATION))).toBeLessThan(xml.indexOf(hex(FLOW)));
    const svg = svgOf(cover(-1)).toUpperCase();
    expect(svg.indexOf(DECORATION)).toBeLessThan(svg.indexOf(FLOW));
  });
});

describe('inherited opacity and rotation', () => {
  const nested = (
    <Slide>
      <Box opacity={0.5} rotate={10} width={100} height={100}>
        <Box opacity={0.5} rotate={5} height={10} backgroundColor="#00AA00" />
      </Box>
    </Slide>
  );

  it('multiplies opacity and adds rotation down the tree', () => {
    const inner = paintOrderOf(fitSlideOf(nested)).find((item) => item.node.path === 'Slide > Box > Box')!;
    expect(inner.opacity).toBeCloseTo(0.25, 6);
    expect(inner.rotations.reduce((sum, rotation) => sum + rotation.degrees, 0)).toBeCloseTo(15, 6);
  });

  it('writes the product alpha and the summed rotation in the XML', async () => {
    const xml = await slideXmlOf(nested);
    const shape = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*00AA00[\s\S]*?<\/p:sp>/)?.[0] ?? '';
    expect(shape).toMatch(/rot="900000"/);
    expect(shape).toMatch(/<a:alpha val="25000"\/>/);
  });
});
