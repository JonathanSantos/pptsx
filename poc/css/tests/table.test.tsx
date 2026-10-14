import { describe, expect, it } from 'vitest';
import { Deck, Slide, Table, defineDeck } from '../index.ts';
import type { PositionedTable } from '../types.ts';
import { pocFit } from './helpers.ts';

/** P2: colunas sem width seguem o conteúdo (table-layout: auto), não a divisão igual da engine. */

const tableOf = (columns: readonly { header: string; width?: number | `${number}%` }[], rows: readonly (readonly string[])[], width: number): PositionedTable => {
  const deck = defineDeck(() => (
    <Deck>
      <Slide alignItems="flex-start">
        <Table columns={columns} rows={rows} width={width} />
      </Slide>
    </Deck>
  ));
  return pocFit(deck, '16x9').positioned.slides[0]!.children[0] as PositionedTable;
};

describe('Table com colunas auto pelo conteúdo', () => {
  const rows = [['Varejo', 'Receita recorrente do trimestre, consolidada']];

  it('com espaço, cada coluna fica com o max-content e a sobra vai na proporção dele', () => {
    const table = tableOf([{ header: 'Área' }, { header: 'Descrição' }], rows, 600);
    const [a, b] = table.columnWidths;
    expect(a! + b!).toBeCloseTo(600, 5);
    expect(b! / a!).toBeGreaterThan(4);
    expect(table.cells[1]!.map((cell) => cell.lines.length)).toEqual([1, 1]);
  });

  it('sem espaço para o max-content, a coluna longa quebra e a curta não', () => {
    const table = tableOf([{ header: 'Área' }, { header: 'Descrição' }], rows, 200);
    expect(table.cells[1]![0]!.lines).toHaveLength(1);
    expect(table.cells[1]![1]!.lines.length).toBeGreaterThan(1);
    expect(table.cells.flat().some((cell) => cell.wordBroken)).toBe(false);
  });

  it('coluna em pt ou % continua fixa', () => {
    const table = tableOf([{ header: 'Área', width: 100 }, { header: 'Descrição' }], rows, 400);
    expect(table.columnWidths[0]).toBe(100);
    expect(table.columnWidths[1]).toBeCloseTo(300, 5);
  });
});
