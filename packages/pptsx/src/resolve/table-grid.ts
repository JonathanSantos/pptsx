import { DEFAULTS, tableHeaderOf, tableStyleOf } from '../core/defaults.ts';
import type {
  CellVerticalAlign,
  Color,
  FontWeight,
  ResolvedCell,
  ResolvedCellIcon,
  TableCellSpec,
  TableCellValue,
  TableProps,
  TextChildren,
  TextRun,
} from '../core/types.ts';
import { hexOf } from './colors.ts';
import { ResolveError } from './errors.ts';
import { iconGeometryOf, type ResolveEnv } from './icon.ts';
import { runsOf } from './runs.ts';
import { parseFontWeight } from './values.ts';

/**
 * Grade da Table (M14): cabeçalhos extras, a linha de `columns` e os dados, cada célula
 * normalizada (texto, runs, merge, estilo, ícone). Posicionamento com merges como o algoritmo
 * de tabela do HTML: cada célula vai na próxima coluna livre da linha; `rowSpan`/`colSpan`
 * ocupam as seguintes. Merge que sai da grade, se sobrepõe ou deixa a linha incompleta →
 * ResolveError (o PPTX não tem como representar).
 */

type TableResolvedProps = Omit<TableProps, 'children'>;

interface SourceRow {
  readonly cells: readonly TableCellValue[];
  readonly header: boolean;
  /** Índice entre as linhas do mesmo tipo (dados: o `row` do `cell()`; cabeçalho: entre os cabeçalhos). */
  readonly index: number;
  /** A linha de `columns[].header`: cada título é da sua coluna; coluna já ocupada por um rowSpan de cima fica sem ele. */
  readonly byColumn?: boolean;
}

const isSpec = (value: TableCellValue): value is TableCellSpec => typeof value === 'object' && value !== null;

const sourceRowsOf = (props: TableResolvedProps): readonly SourceRow[] => {
  const extra = (props.headerRows ?? []).map((cells, index) => ({ cells, header: true, index }));
  const columns = tableHeaderOf(props) === undefined ? [] : [{ cells: props.columns.map((column) => column.header), header: true, index: extra.length, byColumn: true }];
  const data = props.rows.map((cells, index) => ({ cells, header: false, index }));
  return [...extra, ...columns, ...data];
};

const positiveInt = (value: number | undefined, name: string, path: string): number => {
  if (value === undefined) return 1;
  if (Number.isInteger(value) && value >= 1) return value;
  throw new ResolveError(`<Table>: ${name} ${JSON.stringify(value)} inválido; use um inteiro ≥ 1`, path);
};

interface Placement {
  readonly row: number;
  readonly col: number;
  readonly value: TableCellValue;
  readonly source: SourceRow;
  readonly colSpan: number;
  readonly rowSpan: number;
}

const describeRow = (source: SourceRow): string => (source.header ? `a linha ${source.index + 1} do cabeçalho` : `a linha ${source.index + 1}`);

/** Posições de cada célula do autor na grade; lança ResolveError em merge inválido. */
const placementsOf = (rows: readonly SourceRow[], columns: number, path: string): readonly Placement[] => {
  const taken = rows.map(() => new Array<boolean>(columns).fill(false));
  const placements: Placement[] = [];
  rows.forEach((source, row) => {
    if (source.byColumn === true) {
      source.cells.forEach((value, col) => {
        if (taken[row]![col]) return;
        taken[row]![col] = true;
        placements.push({ row, col, value, source, colSpan: 1, rowSpan: 1 });
      });
      return;
    }
    let col = 0;
    source.cells.forEach((value, index) => {
      while (col < columns && taken[row]![col]) col += 1;
      if (col >= columns) {
        // Célula sem coluna livre: a linha tem células demais (contando as cobertas por merge).
        const count = taken[row]!.filter(Boolean).length + source.cells.length - index;
        throw new ResolveError(`<Table>: ${describeRow(source)} tem ${count} células para ${columns} colunas`, path);
      }
      const spec = isSpec(value) ? value : undefined;
      const colSpan = positiveInt(spec?.colSpan, 'colSpan', path);
      const rowSpan = positiveInt(spec?.rowSpan, 'rowSpan', path);
      if (col + colSpan > columns) {
        throw new ResolveError(`<Table>: merge inválido em ${describeRow(source)}: a célula ${col + 1} com colSpan ${colSpan} passa das ${columns} colunas`, path);
      }
      if (row + rowSpan > rows.length) {
        throw new ResolveError(`<Table>: merge inválido em ${describeRow(source)}: rowSpan ${rowSpan} passa do fim da tabela`, path);
      }
      const last = rows[row + rowSpan - 1]!;
      if (last.header !== source.header) {
        throw new ResolveError(`<Table>: merge inválido em ${describeRow(source)}: um rowSpan não atravessa do cabeçalho para os dados`, path);
      }
      for (let r = row; r < row + rowSpan; r += 1) {
        for (let c = col; c < col + colSpan; c += 1) {
          if (taken[r]![c]) throw new ResolveError(`<Table>: merge inválido em ${describeRow(source)}: a célula ${col + 1} se sobrepõe a outra mesclada`, path);
          taken[r]![c] = true;
        }
      }
      placements.push({ row, col, value, source, colSpan, rowSpan });
      col += colSpan;
    });
    const filled = taken[row]!.filter(Boolean).length;
    if (filled !== columns) {
      throw new ResolveError(`<Table>: ${describeRow(source)} tem ${filled} células para ${columns} colunas`, path);
    }
  });
  return placements;
};

// ───────────── estilo ─────────────

interface CellStyle {
  readonly fill?: Color;
  readonly color: Color;
  readonly weight: FontWeight;
  readonly italic: boolean;
}

/** Cabeçalho: o estilo de `header`; dados: zebra nas linhas de dados ímpares (2ª, 4ª…). */
const baseStyleOf = (props: TableResolvedProps, source: SourceRow): CellStyle => {
  const text = tableStyleOf(props);
  const color = props.color ?? DEFAULTS.text.color;
  if (source.header) {
    const header = tableHeaderOf(props) ?? DEFAULTS.table.header;
    return { fill: header.fill, color: header.color ?? color, weight: header.weight ?? DEFAULTS.table.header.weight ?? text.weight, italic: false };
  }
  return { fill: source.index % 2 === 1 ? props.stripe : undefined, color, weight: text.weight, italic: false };
};

const VALIGNS: readonly CellVerticalAlign[] = ['top', 'middle', 'bottom'];

/** O que o `cell()` devolve e o que a célula declara, nessa ordem de precedência (a célula vence). */
const mergedSpecOf = (props: TableResolvedProps, placement: Placement, path: string): TableCellSpec => {
  const own = isSpec(placement.value) ? placement.value : {};
  const computed = props.cell?.({ row: placement.source.index, col: placement.col, value: placement.value, header: placement.source.header }) ?? {};
  if (typeof computed !== 'object' || computed === null) throw new ResolveError('<Table>: cell() tem que devolver um objeto de estilo (ou undefined)', path);
  return { ...computed, ...own };
};

const colorOf = (key: string, value: unknown, path: string): Color | undefined => {
  if (value === undefined) return undefined;
  try {
    return hexOf(key, value);
  } catch {
    throw new ResolveError(`<Table>: ${key} ${JSON.stringify(value)} inválido; use #RRGGBB, rgb() ou um nome de cor`, path);
  }
};

const weightOf = (value: unknown, fallback: FontWeight, path: string): FontWeight => {
  if (value === undefined) return fallback;
  const weight = parseFontWeight(value);
  if (weight === undefined) throw new ResolveError(`<Table>: fontWeight ${JSON.stringify(value)} inválido`, path);
  return weight;
};

/** `children` vence `text`; o que o `cell()` devolver também vale para célula escrita como valor simples. */
const textOfValue = (value: TableCellValue, spec: TableCellSpec): string | number | TextChildren =>
  spec.children ?? spec.text ?? (isSpec(value) ? '' : value);

const runsOfCell = (content: TextChildren, style: CellStyle, path: string): readonly TextRun[] =>
  runsOf(content, { weight: style.weight, italic: style.italic, color: style.color, underline: false, lineThrough: false }, 'none', path);

const iconOf = (spec: TableCellSpec, props: TableResolvedProps, color: Color, path: string, env: ResolveEnv): ResolvedCellIcon | undefined => {
  if (spec.icon === undefined) return undefined;
  const size = spec.icon.size ?? tableStyleOf(props).size;
  const iconColor = colorOf('icon.color', spec.icon.color, path) ?? color;
  const { viewBox, content } = iconGeometryOf({ src: spec.icon.src, size, color: iconColor }, path, env);
  return { viewBox, content, size, color: iconColor };
};

const cellOf = (props: TableResolvedProps, placement: Placement, path: string, env: ResolveEnv): ResolvedCell => {
  const spec = mergedSpecOf(props, placement, path);
  const base = baseStyleOf(props, placement.source);
  const style: CellStyle = {
    fill: colorOf('fill', spec.fill, path) ?? base.fill,
    color: colorOf('color', spec.color, path) ?? base.color,
    weight: weightOf(spec.fontWeight, base.weight, path),
    italic: spec.fontStyle === undefined ? base.italic : spec.fontStyle === 'italic',
  };
  const runs = runsOfCell(textOfValue(placement.value, spec) as TextChildren, style, path);
  const valign = spec.valign ?? props.columns[placement.col]?.valign ?? props.valign ?? 'top';
  if (!VALIGNS.includes(valign)) throw new ResolveError(`<Table>: valign ${JSON.stringify(valign)} inválido; use "top", "middle" ou "bottom"`, path);
  const icon = iconOf(spec, props, style.color, path, env);
  return {
    text: runs.map((run) => run.text).join(''),
    runs,
    colSpan: placement.colSpan,
    rowSpan: placement.rowSpan,
    covered: false,
    header: placement.source.header,
    ...(style.fill === undefined ? {} : { fill: style.fill }),
    align: spec.align ?? props.columns[placement.col]?.align ?? DEFAULTS.text.align,
    valign,
    ...(icon === undefined ? {} : { icon }),
  };
};

const COVERED = (header: boolean, align: ResolvedCell['align'], valign: CellVerticalAlign): ResolvedCell => ({
  text: '',
  runs: [],
  colSpan: 1,
  rowSpan: 1,
  covered: true,
  header,
  align,
  valign,
});

export interface TableGrid {
  readonly grid: readonly (readonly ResolvedCell[])[];
  readonly headerCount: number;
  /** Texto das linhas de dados (compatível com `ResolvedTable.rows`). */
  readonly rows: readonly (readonly string[])[];
}

export const tableGridOf = (props: TableResolvedProps, path: string, env: ResolveEnv): TableGrid => {
  const columns = props.columns.length;
  const sources = sourceRowsOf(props);
  const placements = placementsOf(sources, columns, path);
  const grid = sources.map((source) => Array.from({ length: columns }, () => COVERED(source.header, DEFAULTS.text.align, props.valign ?? 'top')));
  placements.forEach((placement) => {
    grid[placement.row]![placement.col] = cellOf(props, placement, path, env);
  });
  const headerCount = sources.filter((source) => source.header).length;
  return { grid, headerCount, rows: grid.slice(headerCount).map((row) => row.map((cell) => cell.text)) };
};
