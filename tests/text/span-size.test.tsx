import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createFontkitMeasurer, createFontRegistry } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { Deck, Slide, Span, Text } from '../../src/primitives/index.ts';
import type { FontFace, TextRun } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

const measure = createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS), { safety: 1 });
const style = { family: 'Arial', size: 12, weight: 'regular' as const, italic: false, lineHeight: 'normal' as const };
const run = (text: string, size?: number): TextRun => ({ text, weight: 'regular', italic: false, color: '#000000', ...(size === undefined ? {} : { size }) });
const layoutOf = (runs: readonly TextRun[], maxWidth = Infinity) => measure({ content: runs.map((r) => r.text).join(''), style, runs, maxWidth });

describe('M13-7 — medição com corpo por trecho', () => {
  it('sem corpo/família por trecho não há alturas por linha (saída igual à de antes)', () => {
    const plain = layoutOf([run('a b')]);
    expect(plain.lineHeights).toBeUndefined();
    expect(plain.ascents).toBeUndefined();
  });

  it('a linha com o trecho de 28 pt é mais alta; a de 12 pt, não; altura = soma', () => {
    const base = layoutOf([run('x')]);
    const big = layoutOf([run('x', 28)]);
    const mixed = layoutOf([run('linha de doze pontos que quebra '), run('GRANDE', 28), run(' e volta')], 150);
    expect(mixed.lineHeights!.length).toBe(mixed.lines.length);
    const withBig = mixed.lineRuns.findIndex((pieces) => pieces.some((piece) => piece.run === 1));
    expect(mixed.lineHeights![withBig]).toBeCloseTo(big.lineHeight, 6);
    expect(mixed.ascents![withBig]).toBeCloseTo(big.ascent, 6);
    expect(mixed.lineHeights![0]).toBeCloseTo(base.lineHeight, 6);
    expect(mixed.height).toBeCloseTo(mixed.lineHeights!.reduce((a, b) => a + b, 0), 6);
  });

  it('largura do trecho no corpo dele', () => {
    expect(layoutOf([run('M', 28)]).width).toBeCloseTo(layoutOf([run('M')]).width * (28 / 12), 6);
  });
});

const inter = (file: string) => fileURLToPath(new URL(`../../fonts/inter/${file}`, import.meta.url));
const FONTS: readonly FontFace[] = [...DEFAULT_FONTS, { family: 'Inter', weight: 'regular', file: inter('Inter-Regular.ttf') }];

describe('M13-7 — emissão e preview', () => {
  it('cada linha vira um parágrafo com o próprio spcPts; o trecho leva sz próprio', async () => {
    const { xml, positioned } = await build(
      <Deck><Slide><Text width={160} fontSize={12}>Primeira linha de doze pontos e <Span fontSize={28}>grande</Span> depois.</Text></Slide></Deck>,
    );
    const text = positioned.slides[0]!.children[0]!;
    if (text.kind !== 'text') throw new Error('text');
    const heights = text.text.lineHeights!;
    const spacings = [...xml[0]!.matchAll(/<a:spcPts val="(\d+)"\/>/g)].map((m) => Number(m[1]));
    expect(spacings).toEqual(heights.map((h) => Math.round(h * 100)));
    expect(xml[0]).toMatch(/sz="2800"[^>]*>(?:(?!<\/a:rPr>).)*<\/a:rPr><a:t>grande<\/a:t>/s);
  });

  it('Span fontFamily usa a face da família dele (typeface no run)', async () => {
    const { xml } = await build(<Deck><Slide><Text>Arial e <Span fontFamily="Inter">Inter</Span></Text></Slide></Deck>, { fonts: FONTS });
    expect(xml[0]).toMatch(/<a:latin typeface="Inter"[^>]*\/>(?:(?!<\/a:rPr>).)*<\/a:rPr><a:t>Inter<\/a:t>/s);
  });

  it('preview: y de cada linha pela soma das alturas anteriores; tspan com font-size do trecho', async () => {
    const { svg, positioned } = await build(
      <Deck><Slide><Text width={160} fontSize={12}>Primeira linha de doze pontos e <Span fontSize={28}>grande</Span> depois.</Text></Slide></Deck>,
    );
    const text = positioned.slides[0]!.children[0]!;
    if (text.kind !== 'text') throw new Error('text');
    const ys = [...svg[0]!.matchAll(/<text [^>]*y="([\d.]+)"/g)].map((m) => Number(m[1]));
    const expected = text.text.lineHeights!.map((_, i) => text.frame.y + text.text.lineHeights!.slice(0, i).reduce((a, b) => a + b, 0) + text.text.ascents![i]!);
    expected.forEach((y, i) => expect(ys[i]).toBeCloseTo(y, 2));
    expect(svg[0]).toContain('font-size="28"');
  });
});
