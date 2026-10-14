import { describe, expect, it } from 'vitest';
import * as fontkit from 'fontkit';
import type { PositionedTable, PositionedText } from '../../src/core/types.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { Box, Slide, Table, Text } from '../../src/index.ts';
import { byPath, fitSlideOf, slideXmlOf } from '../helpers/css-fit.tsx';

/**
 * M11 (decisão nº 2): `lineHeight` com a semântica do CSS. 'normal' (padrão) = altura natural da
 * face; número = múltiplo do fontSize (1.2 em 20 pt = 24 pt), com a meia-entrelinha acima e
 * abaixo (a baseline desce metade da diferença). O emissor grava spcPts exato para número.
 */

const REGULAR = fontkit.openSync(DEFAULT_FONTS[0]!.file) as fontkit.Font;
const NATURAL_20 = ((REGULAR.ascent - REGULAR.descent + REGULAR.lineGap) / REGULAR.unitsPerEm) * 20;
const ASCENT_20 = (REGULAR.ascent / REGULAR.unitsPerEm) * 20;

const textOf = (el: Parameters<typeof fitSlideOf>[0], path = 'Slide > Text'): PositionedText =>
  byPath(fitSlideOf(el), path) as PositionedText;

describe('lineHeight in the text layout', () => {
  it("'normal' is the natural line of the face", () => {
    const { text } = textOf(<Slide><Text fontSize={20}>x</Text></Slide>);
    expect(text.lineHeight).toBeCloseTo(NATURAL_20, 3);
    expect(text.ascent).toBeCloseTo(ASCENT_20, 3);
  });

  it('1.2 at 20 pt is 24 pt per line', () => {
    const node = textOf(<Slide alignItems="flex-start"><Text fontSize={20} lineHeight={1.2} width={60}>um dois três quatro</Text></Slide>);
    expect(node.text.lineHeight).toBeCloseTo(24, 6);
    expect(node.text.lines.length).toBeGreaterThan(1);
    expect(node.text.height).toBeCloseTo(24 * node.text.lines.length, 6);
    expect(node.frame.height).toBeCloseTo(node.text.height, 6);
  });

  it('a numeric lineHeight moves the baseline down by the half-leading', () => {
    const { text } = textOf(<Slide><Text fontSize={20} lineHeight={1.2}>x</Text></Slide>);
    expect(text.ascent).toBeCloseTo(ASCENT_20 + (24 - NATURAL_20) / 2, 3);
  });

  it('a numeric lineHeight below the natural line moves the baseline up', () => {
    const { text } = textOf(<Slide><Text fontSize={20} lineHeight={1}>x</Text></Slide>);
    expect(text.lineHeight).toBeCloseTo(20, 6);
    expect(text.ascent).toBeCloseTo(ASCENT_20 + (20 - NATURAL_20) / 2, 3);
  });

  it('is inherited from Slide and Box (CSS inherited property)', () => {
    const slide = fitSlideOf(
      <Slide lineHeight={1.5}>
        <Box>
          <Text fontSize={20}>x</Text>
        </Box>
      </Slide>,
    );
    expect((byPath(slide, 'Slide > Box > Text') as PositionedText).text.lineHeight).toBeCloseTo(30, 6);
  });
});

describe('lineHeight in the pptx XML', () => {
  it('a numeric lineHeight is written as exact spcPts (24 pt = 2400)', async () => {
    const xml = await slideXmlOf(<Slide><Text fontSize={20} lineHeight={1.2}>x</Text></Slide>);
    expect(xml).toContain('<a:lnSpc><a:spcPts val="2400"/></a:lnSpc>');
    expect(xml).not.toContain('spcPct');
  });

  it('a Table with a numeric lineHeight measures and writes 24 pt lines', async () => {
    const el = (
      <Slide alignItems="flex-start">
        <Table columns={[{ header: 'A' }, { header: 'B' }]} rows={[['x', 'y']]} size={20} lineHeight={1.2} width={400} />
      </Slide>
    );
    const table = fitSlideOf(el).children[0] as PositionedTable;
    expect(table.cells.flat().every((cell) => Math.abs(cell.lineHeight - 24) < 1e-6)).toBe(true);
    expect(await slideXmlOf(el)).toContain('<a:spcPts val="2400"/>');
  });
});
