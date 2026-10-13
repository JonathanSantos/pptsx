import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx } from '../../src/emit/index.ts';
import { ACTIVE_LINE_SPACING, LINE_SPACING_CALIBRATION, type LineSpacingStrategy } from '../../src/emit/calibration.ts';
import type { TextLayout } from '../../src/core/types.ts';
import { fakeTextLayout, pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

/**
 * Espaçamento de linha via Strategy (M3):
 *  'multiple' → <a:spcPct val = style.lineHeight × LINE_SPACING_CALIBRATION × 100000>
 *  'exact'    → <a:spcPts val = text.lineHeight (pt) × 100>
 */
const LINE_HEIGHT_PROP = 1.25;
const LAYOUT_LINE_HEIGHT = 23.4;

const layout = (content: string): TextLayout => ({ ...fakeTextLayout(content, 18), lineHeight: LAYOUT_LINE_HEIGHT });

const CONTENT = 'first paragraph\nsecond paragraph\nthird';

const slideXml = async (lineSpacing?: LineSpacingStrategy): Promise<string> => {
  const node = pText(rect(10, 10, 300, 100), CONTENT, { lineHeight: LINE_HEIGHT_PROP }, layout(CONTENT));
  const options = lineSpacing === undefined ? { baseDir: tmpdir() } : { baseDir: tmpdir(), lineSpacing };
  const buffer = await emitPptx(pDeck([pSlide([node])]), options);
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('ppt/slides/slide1.xml')!.async('string');
};

const paragraphs = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [];
const lnSpcOf = (p: string): string | undefined => p.match(/<a:lnSpc>[\s\S]*?<\/a:lnSpc>/)?.[0];

const expectedPct = Math.round(LINE_HEIGHT_PROP * LINE_SPACING_CALIBRATION * 100000);
const expectedPts = Math.round(LAYOUT_LINE_HEIGHT * 100);

describe('emit line spacing — strategy "multiple"', () => {
  it('emits spcPct = lineHeight × LINE_SPACING_CALIBRATION × 100000', async () => {
    const xml = await slideXml('multiple');
    expect(xml).toContain(`<a:spcPct val="${expectedPct}"/>`);
    expect(xml).not.toContain('<a:lnSpc><a:spcPts');
  });

  it('every paragraph of the text gets the lnSpc', async () => {
    const ps = paragraphs(await slideXml('multiple'));
    expect(ps).toHaveLength(3);
    for (const p of ps) expect(lnSpcOf(p)).toBe(`<a:lnSpc><a:spcPct val="${expectedPct}"/></a:lnSpc>`);
  });
});

describe('emit line spacing — strategy "exact"', () => {
  it('emits spcPts = text.lineHeight × 100', async () => {
    const xml = await slideXml('exact');
    expect(xml).toContain(`<a:lnSpc><a:spcPts val="${expectedPts}"/></a:lnSpc>`);
    expect(xml).not.toContain('<a:lnSpc><a:spcPct');
  });

  it('every paragraph of the text gets the lnSpc', async () => {
    const ps = paragraphs(await slideXml('exact'));
    expect(ps).toHaveLength(3);
    for (const p of ps) expect(lnSpcOf(p)).toBe(`<a:lnSpc><a:spcPts val="${expectedPts}"/></a:lnSpc>`);
  });
});

describe('emit line spacing — defaults and body', () => {
  it('ACTIVE_LINE_SPACING is a valid strategy', () => {
    expect(['multiple', 'exact']).toContain(ACTIVE_LINE_SPACING);
  });

  it('without lineSpacing the active strategy is used', async () => {
    expect(await slideXml()).toBe(await slideXml(ACTIVE_LINE_SPACING));
  });

  it.each(['multiple', 'exact'] as const)('strategy %s keeps the body free of autofit', async (strategy) => {
    const xml = await slideXml(strategy);
    expect(xml).not.toContain('normAutofit');
    expect(xml).not.toContain('spAutoFit');
  });
});
