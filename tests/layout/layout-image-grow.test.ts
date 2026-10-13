import { describe, expect, it } from 'vitest';
import { layoutSlide } from '../../src/layout/index.ts';
import { FAKE_IMAGE, SIZE_16X9, createFakeEnv, rBox, rImage, rSlide, rect } from '../helpers/nodes.ts';
import { child, expectFrame } from '../helpers/positioned.ts';

/**
 * Caso pendente do M2 (CONTRACTS §layout, Imagem): com grow e sem dimensões o
 * flex define a caixa inteira — inclusive o eixo cruzado esticado por
 * align=stretch — e o fit (contain/cover) cuida da proporção. O frame não trava
 * no aspect ratio intrínseco (FAKE_IMAGE = 400×200, razão 2).
 */
const layout = (children: Parameters<typeof rSlide>[0]) => layoutSlide(rSlide(children), SIZE_16X9, createFakeEnv().env);
const intrinsicRatio = FAKE_IMAGE.width / FAKE_IMAGE.height;

describe('layout — Image with grow in a stretch column', () => {
  it('fills the parent width and the remaining height', () => {
    const slide = layout([rBox({ height: 200 }, [rImage({ src: 'a.png', grow: 1 })])]);
    const frame = child(slide, 0, 0).frame;
    expectFrame(frame, rect(0, 0, 720, 200));
    expect(frame.width / frame.height).not.toBeCloseTo(intrinsicRatio, 2);
  });

  it('fills a narrow, tall parent (portrait frame for a landscape image)', () => {
    const slide = layout([
      rBox({ direction: 'row', align: 'start' }, [rBox({ width: 150, height: 300, align: 'stretch' }, [rImage({ src: 'a.png', grow: 1, fit: 'cover' })])]),
    ]);
    const frame = child(slide, 0, 0, 0).frame;
    expectFrame(frame, rect(0, 0, 150, 300));
    expect(frame.width / frame.height).toBeLessThan(1);
  });

  it('respects the parent padding when stretching', () => {
    const slide = layout([rBox({ height: 200, padding: 20 }, [rImage({ src: 'a.png', grow: 1 })])]);
    expectFrame(child(slide, 0, 0).frame, rect(20, 20, 680, 160));
  });

  it('keeps the intrinsic size recorded even when the frame ignores the ratio', () => {
    const slide = layout([rBox({ height: 200 }, [rImage({ src: 'a.png', grow: 1 })])]);
    const node = child(slide, 0, 0);
    expect(node.kind === 'image' && node.intrinsic).toEqual(FAKE_IMAGE);
  });
});
