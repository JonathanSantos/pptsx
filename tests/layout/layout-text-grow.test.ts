import { describe, expect, it } from 'vitest';
import { layoutSlide } from '../../src/layout/index.ts';
import type { ResolvedNode } from '../../src/core/types.ts';
import { FAKE_LINE_HEIGHT, SIZE_16X9, createFakeEnv, rBox, rText, rect } from '../helpers/nodes.ts';
import { child, expectFrame } from '../helpers/positioned.ts';

/**
 * CONTRACTS §layout "Exceção (M5-F)": Text numa column NÃO recebe basis 0 (a altura é
 * o próprio conteúdo); em row, Text com grow recebe basis 0 normalmente.
 * Medidor falso: 1 linha = 20 pt, largura medida = 100 pt.
 */
const layout = (children: readonly ResolvedNode[]) => layoutSlide({ kind: 'slide', path: 'Slide', props: {}, children }, SIZE_16X9, createFakeEnv().env);

describe('layout — Text with grow in a column (M5-F)', () => {
  it('keeps the measured height in a content-sized column with siblings (not 0)', () => {
    const slide = layout([
      rBox({}, [rText('Rótulo'), rText('Valor', { grow: 1 }), rBox({ height: 50 })]),
    ]);
    const label = child(slide, 0, 0);
    const value = child(slide, 0, 1);
    expect(value.frame.height).toBeCloseTo(FAKE_LINE_HEIGHT);
    expect(value.frame.y).toBeCloseTo(label.frame.y + FAKE_LINE_HEIGHT);
    expectFrame(child(slide, 0).frame, rect(0, 0, 720, 2 * FAKE_LINE_HEIGHT + 50));
  });

  it('grows into the space left by a fixed sibling (100 − 60 = 40)', () => {
    const slide = layout([
      rBox({ height: 100 }, [rText('Valor', { grow: 1 }), rBox({ height: 60, shrink: 0 })]),
    ]);
    expect(child(slide, 0, 0).frame.height).toBeCloseTo(40);
  });

  it('a two-line growing text keeps both lines of height in a content-sized column', () => {
    const slide = layout([rBox({}, [rText('a\nb', { grow: 1 }), rText('c')])]);
    expect(child(slide, 0, 0).frame.height).toBeCloseTo(2 * FAKE_LINE_HEIGHT);
  });

  it('still distributes leftover height when the column has room', () => {
    const slide = layout([rBox({ height: 200 }, [rText('Valor', { grow: 1 }), rBox({ height: 50 })])]);
    expect(child(slide, 0, 0).frame.height).toBeCloseTo(150);
  });
});

describe('layout — Text with grow in a row keeps basis 0', () => {
  it('splits the row width by grow ratio, ignoring the measured width', () => {
    // Base 0: 1:3 de 400 → 100/300. Com base = largura medida (100) seria 150/250.
    const slide = layout([rBox({ direction: 'row', width: 400 }, [rText('a', { grow: 1 }), rText('b', { grow: 3 })])]);
    expect(child(slide, 0, 0).frame.width).toBeCloseTo(100);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(300);
  });

  it('equal grow gives equal widths next to a fixed sibling', () => {
    const slide = layout([
      rBox({ direction: 'row', width: 500 }, [rBox({ width: 100 }), rText('curto', { grow: 1 }), rText('um texto mais longo', { grow: 1 })]),
    ]);
    expect(child(slide, 0, 1).frame.width).toBeCloseTo(200);
    expect(child(slide, 0, 2).frame.width).toBeCloseTo(200);
  });
});
