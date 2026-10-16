import { describe, expect, it } from 'vitest';
import type { PositionedSlide, SlideElement } from '../../src/core/types.ts';
import { Box, Shape, Slide, Text } from '../../src/index.ts';
import { byPath, fitSlideOf } from '../helpers/css-fit.tsx';

/**
 * M19 (CONTRACTS.md, src/layout): contribuição mínima do item de grid (`minWidth` do autor substitui o
 * min-content) e proporção esticada no grid (`maxHeight × aspectRatio` vira `maxWidth`). Frames à mão (16:9).
 */

const slideOf = (slide: SlideElement): PositionedSlide => fitSlideOf(slide);

const frame = (slide: PositionedSlide, path: string) => {
  const { x, y, width, height } = byPath(slide, path).frame;
  return [x, y, width, height].map((v) => Math.round(v * 100) / 100);
};

const LONG = 'Uma frase bem comprida que não cabe em metade da grade';

/** Grade 400 pt com duas trilhas `1fr`; a 1ª célula tem um Text nowrap largo dentro de um Box. */
const twoColumns = (item: Record<string, unknown>) =>
  slideOf(
    <Slide>
      <Box display="grid" gridTemplateColumns="1fr 1fr" width={400} height={100}>
        <Box {...item}>
          <Text nowrap fontSize={20}>{LONG}</Text>
        </Box>
        <Box />
      </Box>
    </Slide>,
  );

describe('M19 — contribuição mínima do item de grid', () => {
  it('sem minWidth: a trilha 1fr cresce até o min-content (comportamento antigo)', () => {
    const slide = twoColumns({});
    const [, , first] = frame(slide, 'Slide > Box > Box[0]');
    const [, , second] = frame(slide, 'Slide > Box > Box[1]');
    // a 1ª trilha vai ao min-content do nowrap (passa até da grade); a 2ª fica com o que sobra
    expect(first).toBeGreaterThan(200);
    expect(second).toBeLessThan(first!);
  });

  it('minWidth={0}: as trilhas 1fr ficam iguais mesmo com conteúdo largo', () => {
    const slide = twoColumns({ minWidth: 0 });
    expect(frame(slide, 'Slide > Box > Box[0]')).toEqual([0, 0, 200, 100]);
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([200, 0, 200, 100]);
  });

  it('minWidth numérico > 0 vira a contribuição mínima', () => {
    const slide = twoColumns({ minWidth: 300 });
    expect(frame(slide, 'Slide > Box > Box[0]')).toEqual([0, 0, 300, 100]);
    expect(frame(slide, 'Slide > Box > Box[1]')).toEqual([300, 0, 100, 100]);
  });

  it('minWidth menor que a fração: a trilha fica na fração (o mínimo não empurra)', () => {
    const slide = twoColumns({ minWidth: 50 });
    expect(frame(slide, 'Slide > Box > Box[0]')).toEqual([0, 0, 200, 100]);
  });

  it('item com width numérica: nada muda com minWidth', () => {
    const without = twoColumns({ width: 300 });
    const withMin = twoColumns({ width: 300, minWidth: 0 });
    expect(frame(withMin, 'Slide > Box > Box[0]')).toEqual(frame(without, 'Slide > Box > Box[0]'));
    expect(frame(withMin, 'Slide > Box > Box[1]')).toEqual(frame(without, 'Slide > Box > Box[1]'));
    expect(frame(without, 'Slide > Box > Box[0]')[2]).toBe(300);
  });

  it('minmax(0, 1fr) continua ignorando o conteúdo', () => {
    const slide = slideOf(
      <Slide>
        <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" width={400} height={100}>
          <Box><Text nowrap fontSize={20}>{LONG}</Text></Box>
          <Box />
        </Box>
      </Slide>,
    );
    expect(frame(slide, 'Slide > Box > Box[0]')).toEqual([0, 0, 200, 100]);
  });
});

/** Uma célula 240×150 com a Shape como item direto. */
const cell = (shape: SlideElement) =>
  slideOf(
    <Slide>
      <Box display="grid" gridTemplateColumns="240px" gridTemplateRows="150px" width={240} height={150}>
        {shape}
      </Box>
    </Slide>,
  );

describe('M19 — proporção esticada no grid', () => {
  it('aspectRatio 1 + maxHeight "100%": 150×150, não elipse', () => {
    const slide = cell(<Shape kind="ellipse" aspectRatio={1} maxHeight="100%" />);
    const [, , width, height] = frame(slide, 'Slide > Box > Shape');
    expect([width, height]).toEqual([150, 150]);
  });

  it('variante numérica: maxHeight 150', () => {
    const slide = cell(<Shape kind="ellipse" aspectRatio={1} maxHeight={150} />);
    const [, , width, height] = frame(slide, 'Slide > Box > Shape');
    expect([width, height]).toEqual([150, 150]);
  });

  it('maxWidth do autor menor vence: min(100, 150 × 1)', () => {
    const slide = cell(<Shape kind="ellipse" aspectRatio={1} maxHeight="100%" maxWidth={100} />);
    const [, , width, height] = frame(slide, 'Slide > Box > Shape');
    expect([width, height]).toEqual([100, 100]);
  });

  it('maxWidth do autor maior: a restrição transferida (150) vence', () => {
    const slide = cell(<Shape kind="ellipse" aspectRatio={1} maxHeight="100%" maxWidth={200} />);
    const [, , width, height] = frame(slide, 'Slide > Box > Shape');
    expect([width, height]).toEqual([150, 150]);
  });

  it('aspectRatio 2 + maxHeight 100: maxWidth transferido = 200', () => {
    const slide = cell(<Shape kind="rect" aspectRatio={2} maxHeight={100} />);
    const [, , width, height] = frame(slide, 'Slide > Box > Shape');
    expect([width, height]).toEqual([200, 100]);
  });

  it('sem maxHeight: comportamento antigo (estica na largura da célula)', () => {
    const slide = cell(<Shape kind="ellipse" aspectRatio={1} />);
    const [, , width] = frame(slide, 'Slide > Box > Shape');
    expect(width).toBe(240);
  });
});
