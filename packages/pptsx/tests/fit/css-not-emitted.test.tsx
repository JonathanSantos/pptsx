import { describe, expect, it } from 'vitest';
import type { SlideElement } from '../../src/core/types.ts';
import { Box, Image, Shape, Slide } from '../../src/index.ts';
import { slideToSvg } from '../../src/preview/index.ts';
import { EXAMPLES_DIR, cssFit, deckOf, fitSlideOf } from '../helpers/css-fit.tsx';

/**
 * M11: `css-not-emitted` (warning) para CSS válido sem de/para no PPTX. `overflow: hidden` fica
 * em `css.overflow` (não em notEmitted) e o aviso sai do fit (`cssNotEmittedOf`), só em Box:
 * em Image é o recorte legítimo do cover. O preview também não recorta.
 */

const clipped: SlideElement = (
  <Slide>
    <Box width={100} height={50} style={{ overflow: 'hidden' }}>
      <Shape kind="rect" width={300} height={300} fill="#00AA00" />
    </Box>
  </Slide>
);

const notEmittedOf = (slide: SlideElement) => cssFit(deckOf(slide)).diagnostics.filter((d) => d.code === 'css-not-emitted');

describe("style={{ overflow: 'hidden' }}", () => {
  it('is kept in css.overflow, not in css.notEmitted', () => {
    const box = fitSlideOf(clipped).children[0]!;
    expect(box.css.overflow).toBe('hidden');
    expect(box.css.notEmitted).toEqual([]);
  });

  it('warns once on the Box with the property and the path', () => {
    const warnings = notEmittedOf(clipped);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ severity: 'warning', code: 'css-not-emitted', slide: 1, path: 'Slide > Box' });
    expect(warnings[0]!.message).toContain('overflow: hidden');
  });

  it('does not warn on an Image', () => {
    expect(notEmittedOf(<Slide><Image src="assets/chart.png" width={100} style={{ overflow: 'hidden' }} /></Slide>)).toEqual([]);
  });

  it('is not drawn by the preview (no clip around the children)', () => {
    const svg = slideToSvg(fitSlideOf(clipped), { name: '16x9', width: 720, height: 405 }, { widthPx: 320, baseDir: EXAMPLES_DIR });
    expect(svg).not.toContain('clip-path');
    expect(svg.toUpperCase()).toContain('00AA00');
  });
});
