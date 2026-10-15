import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { B, Deck, Slide, Table } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { PositionedTable, SlideElement, TableProps } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

let baseDir = '';
beforeAll(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'pptsx-cells-'));
  writeFileSync(join(baseDir, 'i.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/></svg>');
});
afterAll(() => rmSync(baseDir, { recursive: true, force: true }));

const COLUMNS = [{ header: 'A' }, { header: 'B' }, { header: 'C' }];
const one = (props: Partial<TableProps>) => (
  <Deck>
    <Slide padding={20}>
      <Table border="#CCCCCC" {...({ columns: COLUMNS, rows: [], ...props } as TableProps)} />
    </Slide>
  </Deck>
);
const ctx = createContext(resolveSize('16x9'));
const resolve = (props: Partial<TableProps>) => {
  const table = resolveDeck(one(props) as SlideElement, ctx, { readAsset: () => '' }).slides[0]!.children[0]!;
  if (table.kind !== 'table') throw new Error('table');
  return table;
};

describe('M14-3 — grade (resolve)', () => {
  it('cabeçalho de dois níveis: headerRows com colSpan e rowSpan; a linha de columns pula a coluna ocupada', () => {
    const table = resolve({ headerRows: [[{ text: 'Grupo', rowSpan: 2 }, { text: '2026', colSpan: 2 }]], rows: [['x', 'y', 'z']] });
    expect(table.headerCount).toBe(2);
    expect(table.grid[0]!.map((c) => [c.text, c.colSpan, c.rowSpan, c.covered])).toEqual([['Grupo', 1, 2, false], ['2026', 2, 1, false], ['', 1, 1, true]]);
    expect(table.grid[1]!.map((c) => [c.text, c.covered])).toEqual([['', true], ['B', false], ['C', false]]);
    expect(table.rows).toEqual([['x', 'y', 'z']]);
  });

  it('rowSpan 3 na 1ª coluna: as linhas seguintes têm uma célula a menos', () => {
    const table = resolve({ rows: [[{ text: 'G', rowSpan: 3 }, 'a', '1'], ['b', '2'], ['c', '3']] });
    expect(table.grid.slice(1).map((row) => row.map((c) => (c.covered ? '·' : c.text)))).toEqual([['G', 'a', '1'], ['·', 'b', '2'], ['·', 'c', '3']]);
  });

  it('cell(): estilo pelo valor; a célula vence; children (rich text) vence text', () => {
    const table = resolve({
      rows: [['x', -5, 3], ['y', { text: 9, color: '#0000FF' }, 1], [{ children: <>rico <B>forte</B></> }, 0, 0]],
      cell: ({ value, header }) => (header || typeof value !== 'number' ? undefined : { color: value < 0 ? '#FF0000' : '#008000', text: `${value}%` }),
    });
    const data = table.grid.slice(1);
    expect(data[0]![1]).toMatchObject({ text: '-5%', runs: [expect.objectContaining({ color: '#FF0000' })] });
    expect(data[1]![1]).toMatchObject({ text: '9', runs: [expect.objectContaining({ color: '#0000FF' })] });
    expect(data[2]![0]!.runs.map((r) => [r.text, r.weight])).toEqual([['rico ', 'regular'], ['forte', 'bold']]);
  });

  it.each([
    [[[{ text: 'x', colSpan: 4 }]], /passa das 3 colunas/],
    [[[{ text: 'x', rowSpan: 3 }, 'a', 'b']], /passa do fim da tabela/],
    [[['a', 'b', 'c', 'd']], /tem 4 células para 3 colunas/],
    [[['a', 'b']], /tem 2 células para 3 colunas/],
    [[[{ text: 'x', colSpan: 0 }, 'a', 'b']], /colSpan 0 inválido/],
  ])('merge inválido %j → ResolveError', (rows, message) => {
    expect(() => resolve({ rows: rows as TableProps['rows'] })).toThrow(message);
  });
});

const tableOf = (positioned: Awaited<ReturnType<typeof build>>['positioned']): PositionedTable => {
  const node = positioned.slides[0]!.children[0]!;
  if (node.kind !== 'table') throw new Error('table');
  return node;
};

describe('M14-3 — layout e PPTX', () => {
  it('rowSpan: a célula alta reparte a altura que falta pelas linhas que cobre', async () => {
    const tall = 'uma linha\nduas\ntrês\nquatro\ncinco\nseis';
    const { positioned } = await build(one({ rows: [[{ text: tall, rowSpan: 2 }, 'a', '1'], ['b', '2']] }));
    const table = tableOf(positioned);
    const [, r1, r2] = table.rowHeights;
    expect(r1).toBeCloseTo(r2!, 0);
    expect(r1! + r2!).toBeGreaterThanOrEqual(table.cells[1]![0]!.height);
  });

  it('XML: gridSpan/rowSpan e células de continuação; fill e cor por célula', async () => {
    const { xml } = await build(
      one({ headerRows: [[{ text: 'Topo', colSpan: 3 }]], rows: [[{ text: 'G', rowSpan: 2, fill: '#EEF2FF' }, { text: 'neg', color: '#B91C1C' }, '1'], ['b', '2']] }),
    );
    expect(xml[0]).toMatch(/<a:tc gridSpan="3"/);
    expect(xml[0]).toMatch(/<a:tc rowSpan="2"/);
    expect(xml[0]).toMatch(/hMerge="1"/);
    expect(xml[0]).toMatch(/vMerge="1"/);
    expect(xml[0]).toContain('<a:srgbClr val="EEF2FF"/>');
    expect(xml[0]).toMatch(/<a:srgbClr val="B91C1C"\/>[\s\S]*?<a:t>neg<\/a:t>/);
  });

  it('valign por célula → anchor', async () => {
    const { xml } = await build(one({ valign: 'middle', rows: [['a', { text: 'b', valign: 'bottom' }, 'c']] }));
    expect(xml[0]).toMatch(/anchor="ctr"/);
    expect(xml[0]).toMatch(/anchor="b"/);
  });

  it('ícone na célula: forma sobre a tabela, espaço inicial com charSpacing, table-cell-icon (info)', async () => {
    const { xml, diagnostics, positioned, svg } = await build(one({ rows: [[{ text: 'Site', icon: { src: 'i.svg', color: '#2F6FED' } }, 'b', 'c']] }), { baseDir });
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'table-cell-icon', severity: 'info' })]);
    expect(tableOf(positioned).spaceWidth).toBeGreaterThan(0);
    expect(xml[0]).toMatch(/<a:rPr[^>]*spc="\d+"[^>]*>[\s\S]*?<a:t> <\/a:t>/);
    expect(xml[0]).toContain('<a:custGeom>');
    expect(svg[0]).toContain('stroke="#2F6FED"');
  });

  it('preview: célula mesclada sem linha por dentro', async () => {
    const { svg, positioned } = await build(one({ headerRows: [[{ text: 'Topo', colSpan: 3 }]], rows: [['a', 'b', 'c']] }));
    const table = tableOf(positioned);
    const top = table.frame.y + table.rowHeights[0]! / 2;
    const verticals = [...svg[0]!.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="\1" y2="([\d.]+)"/g)].filter((m) => Number(m[2]) <= top && Number(m[3]) >= top);
    // Só as bordas esquerda e direita atravessam a linha do título mesclado.
    expect(verticals).toHaveLength(2);
  });
});
