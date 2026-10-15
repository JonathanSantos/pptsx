import { describe, expect, it } from 'vitest';
import type { PositionedTable } from '../../src/core/types.ts';
import { Deck, Slide, Table, defineDeck } from '../../src/index.ts';
import { cssFit } from '../helpers/css-fit.tsx';

/** M11 (P2, de poc/css/tests/table.test.tsx): colunas sem width seguem o conteúdo (table-layout: auto), não a divisão igual. */

const tableOf = (columns: readonly { header: string; width?: number | `${number}%` }[], rows: readonly (readonly string[])[], width: number): PositionedTable => {
  const deck = defineDeck(() => (
    <Deck>
      <Slide alignItems="flex-start">
        <Table columns={columns} rows={rows} width={width} />
      </Slide>
    </Deck>
  ));
  return cssFit(deck, '16x9').positioned.slides[0]!.children[0] as PositionedTable;
};

describe('Table with auto columns sized by content', () => {
  const rows = [['Varejo', 'Receita recorrente do trimestre, consolidada']];

  it('with room, each column gets its max-content and the rest in proportion', () => {
    const table = tableOf([{ header: 'Área' }, { header: 'Descrição' }], rows, 600);
    const [a, b] = table.columnWidths;
    expect(a! + b!).toBeCloseTo(600, 5);
    expect(b! / a!).toBeGreaterThan(4);
    expect(table.cells[1]!.map((cell) => cell.lines.length)).toEqual([1, 1]);
  });

  it('without room for max-content, the long column wraps and the short one does not', () => {
    const table = tableOf([{ header: 'Área' }, { header: 'Descrição' }], rows, 200);
    expect(table.cells[1]![0]!.lines).toHaveLength(1);
    expect(table.cells[1]![1]!.lines.length).toBeGreaterThan(1);
    expect(table.cells.flat().some((cell) => cell.wordBroken)).toBe(false);
  });

  it('columns in pt or % stay fixed', () => {
    const table = tableOf([{ header: 'Área', width: 100 }, { header: 'Descrição' }], rows, 400);
    expect(table.columnWidths[0]).toBe(100);
    expect(table.columnWidths[1]).toBeCloseTo(300, 5);
  });
});
