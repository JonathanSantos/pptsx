import { describe, expect, it } from 'vitest';
import { tableCutsOf } from '../../src/fit/paginate.ts';
import { Box, Deck, Slide, Table, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { PositionedNode, PositionedTable, ResolvedTable, SlideElement, TableCellValue } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

const ctx = createContext(resolveSize('16x9'));

const COLUMNS = [{ header: 'Nº' }, { header: 'Item' }, { header: 'Valor', align: 'right' as const }];

const rowsOf = (count: number): TableCellValue[][] => Array.from({ length: count }, (_, i) => [String(i + 1), `Item ${i + 1}`, String((i + 1) * 10)]);

const tablesOf = (nodes: readonly PositionedNode[]): readonly PositionedTable[] =>
  nodes.flatMap((node) => (node.kind === 'table' ? [node] : node.kind === 'box' ? tablesOf(node.children) : []));

const resolvedTableOf = (rows: TableCellValue[][]): ResolvedTable => {
  const deck = resolveDeck((<Deck><Slide><Table columns={COLUMNS} rows={rows} /></Slide></Deck>) as SlideElement, ctx);
  return deck.slides[0]!.children[0] as ResolvedTable;
};

describe('M14-4 — cortes da tabela', () => {
  it('tableCutsOf: nunca dentro de um rowSpan', () => {
    const rows = rowsOf(5);
    rows[1] = [{ text: '2', rowSpan: 3 }, 'Item 2', '20'];
    rows[2] = ['Item 3', '30'];
    rows[3] = ['Item 4', '40'];
    expect(tableCutsOf(resolvedTableOf(rows))).toEqual([true, true, false, false, true, true]);
  });
});

describe('M14-4 — Table paginate de ponta a ponta', () => {
  const deck = (props: { paginate?: boolean; repeatHeader?: boolean; rows?: TableCellValue[][] } = {}) => (
    <Deck>
      <Slide padding={30} gap={10}>
        <Text fontSize={24} fontWeight="bold">Título fixo</Text>
        <Table paginate={props.paginate ?? true} repeatHeader={props.repeatHeader} flex={1} fontSize={14} columns={COLUMNS} rows={props.rows ?? rowsOf(40)} />
        <Text fontSize={10}>Rodapé</Text>
      </Slide>
    </Deck>
  );

  it('40 linhas → partes com o cabeçalho repetido, sem encolher, com slide-continued (linhas da tabela)', async () => {
    const { positioned, diagnostics } = await build(deck());
    expect(positioned.slides.length).toBeGreaterThan(1);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diagnostics.some((d) => d.code === 'table-overflow')).toBe(false);
    const notice = diagnostics.find((d) => d.code === 'slide-continued');
    expect(notice?.data).toMatchObject({ kind: 'table', parts: positioned.slides.length });
    expect(notice?.message).toMatch(/de 40 linhas da tabela no 1º/);
    const tables = positioned.slides.map((slide) => tablesOf(slide.children)[0]!);
    tables.forEach((table) => {
      expect(table.headerCount).toBe(1);
      expect(table.grid[0]!.map((cell) => cell.text)).toEqual(['Nº', 'Item', 'Valor']);
      expect(table.fontSize).toBe(14);
    });
    // Todas as linhas, na ordem, uma vez só.
    expect(tables.flatMap((table) => table.rows.map((row) => row[0]))).toEqual(rowsOf(40).map((row) => row[0]));
  });

  it('repeatHeader={false}: só a 1ª parte tem cabeçalho', async () => {
    const { positioned } = await build(deck({ repeatHeader: false }));
    const tables = positioned.slides.map((slide) => tablesOf(slide.children)[0]!);
    expect(tables.map((table) => table.headerCount)).toEqual(tables.map((_, i) => (i === 0 ? 1 : 0)));
  });

  it('rowSpan na fronteira vai inteiro para a próxima parte', async () => {
    const plain = await build(deck());
    const first = tablesOf(plain.positioned.slides[0]!.children)[0]!.rows.length;
    // Um rowSpan 3 que começa na última linha que caberia na 1ª parte.
    const rows = rowsOf(40);
    const start = first - 1;
    rows[start] = [{ text: String(start + 1), rowSpan: 3 }, `Item ${start + 1}`, '0'];
    rows[start + 1] = [`Item ${start + 2}`, '0'];
    rows[start + 2] = [`Item ${start + 3}`, '0'];
    const { positioned } = await build(deck({ rows }));
    const [a, b] = positioned.slides.map((slide) => tablesOf(slide.children)[0]!);
    expect(a!.rows.length).toBe(start);
    expect(b!.grid[1]![0]!.rowSpan).toBe(3);
  });

  it('sem paginate não pagina: table-overflow no mesmo slide', async () => {
    const { positioned, diagnostics } = await build(deck({ paginate: false }));
    expect(positioned.slides).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === 'table-overflow')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'slide-continued')).toBe(false);
  });

  it('dois nós paginate e Table absoluta → ResolveError', () => {
    const resolve = (node: unknown) => resolveDeck((<Deck><Slide>{node as never}</Slide></Deck>) as SlideElement, ctx);
    const table = (props: object) => <Table columns={COLUMNS} rows={rowsOf(2)} {...props} />;
    expect(() => resolve(<><Box paginate />{table({ paginate: true })}</>)).toThrow(/<Table paginate>/);
    expect(() => resolve(table({ paginate: true, position: 'absolute' }))).toThrow(/position="absolute"/);
  });
});
