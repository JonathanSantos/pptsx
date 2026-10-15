import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Chart, Deck, Slide } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { slideToSvg } from '../../src/preview/index.ts';
import type { ChartProps, SlideElement } from '../../src/core/types.ts';

const Q = ['T1', 'T2', 'T3'];
const TWO = { categories: Q, series: [{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [3, 2, 1] }] };

const built = async (props: Partial<ChartProps> & Pick<ChartProps, 'kind' | 'data'>) => {
  const deck = (<Deck><Slide><Chart width={400} height={240} {...(props as ChartProps)} /></Slide></Deck>);
  const [result] = await render(() => deck, { preview: false, includePositioned: true });
  const zip = await JSZip.loadAsync(result!.buffer);
  const chartFile = Object.keys(zip.files).find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))!;
  const xml = await zip.file(chartFile)!.async('string');
  const svg = slideToSvg(result!.positioned!.slides[0]!, result!.positioned!.size, { widthPx: 720, baseDir: process.cwd() });
  return { xml, svg, diagnostics: result!.diagnostics };
};

describe('M14-2 — XML por kind', () => {
  it('barH: barChart com barDir="bar" e grouping clustered', async () => {
    const { xml } = await built({ kind: 'barH', data: TWO });
    expect(xml).toContain('<c:barChart>');
    expect(xml).toMatch(/<c:barDir val="bar"\/>/);
    expect(xml).toMatch(/<c:grouping val="clustered"\/>/);
  });

  it.each([
    ['stackedBar', 'col', 'stacked'],
    ['stackedBarH', 'bar', 'stacked'],
    ['stackedBar100', 'col', 'percentStacked'],
  ] as const)('%s: barDir %s, grouping %s, overlap 100', async (kind, dir, grouping) => {
    const { xml } = await built({ kind, data: TWO });
    expect(xml).toMatch(new RegExp(`<c:barDir val="${dir}"/>`));
    expect(xml).toMatch(new RegExp(`<c:grouping val="${grouping}"/>`));
    expect(xml).toMatch(/<c:overlap val="100"\/>/);
  });

  it('stackedBar100: eixo de valores em %', async () => {
    const { xml } = await built({ kind: 'stackedBar100', data: TWO });
    expect(xml).toMatch(/<c:valAx>[\s\S]*formatCode="0%"/);
  });

  it('area e stackedArea: areaChart com grouping standard/stacked', async () => {
    // 'standard' é o padrão do OOXML: o pptxgenjs não grava.
    expect((await built({ kind: 'area', data: TWO })).xml).toMatch(/<c:areaChart><c:varyColors/);
    expect((await built({ kind: 'stackedArea', data: TWO })).xml).toMatch(/<c:areaChart>[\s\S]*<c:grouping val="stacked"\/>/);
  });

  it('doughnut: holeSize do autor', async () => {
    const { xml } = await built({ kind: 'doughnut', holeSize: 60, data: { categories: Q, series: [{ name: 'A', values: [1, 2, 3] }] } });
    expect(xml).toContain('<c:doughnutChart>');
    expect(xml).toMatch(/<c:holeSize val="60"\/>/);
  });

  it('scatter: scatterChart, x unidos e ponto ausente omitido (não vira 0)', async () => {
    const { xml } = await built({ kind: 'scatter', data: { series: [{ name: 'A', points: [[1, 5], [3, 7]] }, { name: 'B', points: [[2, 6]] }] } });
    expect(xml).toContain('<c:scatterChart>');
    expect(xml).not.toContain('<c:v></c:v>');
    expect(xml).toMatch(/<c:xVal>[\s\S]*<c:v>1<\/c:v>[\s\S]*<c:v>2<\/c:v>[\s\S]*<c:v>3<\/c:v>/);
  });

  it('combo com eixo secundário: barChart + lineChart e dois valAx', async () => {
    const { xml } = await built({
      kind: 'combo',
      data: { categories: Q, series: [{ name: 'R', values: [1, 2, 3], as: 'bar' }, { name: 'M', values: [0.1, 0.2, 0.3], as: 'line', axis: 'secondary' }] },
      y2Axis: { format: '0%' },
    });
    expect(xml).toContain('<c:barChart>');
    expect(xml).toContain('<c:lineChart>');
    expect(xml.match(/<c:valAx>/g)).toHaveLength(2);
    expect(xml).toMatch(/formatCode="0%"/);
  });

  it('eixos: título, min/max/step e legenda na posição pedida', async () => {
    const { xml } = await built({ kind: 'line', data: TWO, yAxis: { title: 'pontos', min: 0, max: 10, step: 2 }, legend: { position: 'top' } });
    expect(xml).toContain('pontos');
    expect(xml).toMatch(/<c:max val="10"\/>/);
    expect(xml).toMatch(/<c:majorUnit val="2"\/>/);
    expect(xml).toMatch(/<c:legendPos val="t"\/>/);
  });

  it('rótulos com formato próprio', async () => {
    const { xml } = await built({ kind: 'bar', data: TWO, labels: { format: '0.0' } });
    expect(xml).toMatch(/<c:showVal val="1"\/>/);
    expect(xml).toContain('formatCode="0.0"');
  });
});

describe('M14-2 — validação', () => {
  const ctx = createContext(resolveSize('16x9'));
  const resolve = (props: object) => resolveDeck((<Deck><Slide><Chart width={100} height={100} {...(props as ChartProps)} /></Slide></Deck>) as SlideElement, ctx);
  it.each([
    [{ kind: 'scatter', data: { series: [{ name: 'A' }] } }, /precisa de points/],
    [{ kind: 'scatter', data: { series: [{ name: 'A', points: [[1, 'x']] }] } }, /ponto inválido no índice 0/],
    [{ kind: 'combo', data: TWO }, /precisa de as: "bar" ou "line"/],
    [{ kind: 'doughnut', data: TWO }, /aceita uma única série/],
    [{ kind: 'doughnut', holeSize: 95, data: { categories: Q, series: [{ name: 'A', values: [1, 2, 3] }] } }, /holeSize 95/],
    [{ kind: 'barH', data: { series: TWO.series } }, /precisa de data/],
  ])('%j → ResolveError', (props, message) => {
    expect(() => resolve(props)).toThrow(message);
  });
});

describe('M14-2 — preview', () => {
  it('barH desenha retângulos deitados (largura > altura)', async () => {
    const { svg } = await built({ kind: 'barH', data: { categories: Q, series: [{ name: 'A', values: [5, 8, 3] }] } });
    const rects = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)" fill="#2F6FED"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(rects.length).toBeGreaterThanOrEqual(3);
    rects.slice(-3).forEach(([w, h]) => expect(w!).toBeGreaterThan(h!));
  });

  it('area: polígonos; doughnut: fatias com furo (arco interno); scatter: círculos; combo: barras + polilinha', async () => {
    expect((await built({ kind: 'area', data: TWO })).svg).toContain('<polygon');
    expect((await built({ kind: 'doughnut', data: { categories: Q, series: [{ name: 'A', values: [1, 2, 3] }] } })).svg).toMatch(/A [\d.]+ [\d.]+ 0 [01] 0 /);
    expect((await built({ kind: 'scatter', data: { series: [{ name: 'A', points: [[1, 5], [3, 7]] }] } })).svg.match(/<circle/g)!.length).toBeGreaterThanOrEqual(2);
    const combo = await built({ kind: 'combo', data: { categories: Q, series: [{ name: 'R', values: [1, 2, 3], as: 'bar' }, { name: 'M', values: [3, 1, 2], as: 'line', axis: 'secondary' }] } });
    expect(combo.svg).toContain('<polyline');
    expect(combo.svg).toContain('fill="#2F6FED"');
  });
});
