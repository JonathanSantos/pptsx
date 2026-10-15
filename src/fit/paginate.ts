import { DEFAULTS } from '../core/defaults.ts';
import type { Diagnostic, DiagnosticCode, PositionedNode, PositionedText, ResolvedBox, ResolvedNode, ResolvedSlide, ResolvedTable, ResolvedText, TextRun } from '../core/types.ts';
import { cutLineOf, offsetAfterLines, splitRunsAt, withRuns } from './text-split.ts';
import { paginationLimit, slideContinued, withPaginationStop } from './diagnostics.ts';
import type { DiagnosticContext } from './diagnostics.ts';
import { fitSlide, fitSlideFrozen } from './fit.ts';
import type { FitInput, FitResult } from './fit.ts';
import { isWithin } from './scope.ts';

// Slide de continuação (CONTRACTS §M9 fit): um Box paginate (P) que não cabe é dividido em
// partes, cada uma um clone do slide com um trecho dos filhos em fluxo de P. Enquanto pagina,
// os Text de P não encolhem: paginar existe justamente para não encolher a lista.

const MAX_PARTS = DEFAULTS.paginate.maxParts;

const isAbsolute = (node: ResolvedNode): boolean => node.css.position === 'absolute';

const paginatedIn = (node: ResolvedNode): ResolvedBox | undefined => {
  if (node.kind !== 'box') return undefined;
  if (node.props.paginate === true) return node;
  return paginatedBoxOf(node.children);
};

const paginatedBoxOf = (nodes: readonly ResolvedNode[]): ResolvedBox | undefined =>
  nodes.reduce<ResolvedBox | undefined>((found, node) => found ?? paginatedIn(node), undefined);

/** P fica com os filhos `absolute` (decoração vai em todas as partes) e os itens escolhidos, na ordem original. */
const withItems = (nodes: readonly ResolvedNode[], box: ResolvedBox, items: ReadonlySet<ResolvedNode>): readonly ResolvedNode[] =>
  nodes.map((node) => {
    if (node.kind !== 'box') return node;
    if (node.path === box.path) return { ...node, children: node.children.filter((child) => isAbsolute(child) || items.has(child)) };
    return { ...node, children: withItems(node.children, box, items) };
  });

interface Paging {
  /** Slide original; `slideIndex` é o índice de saída da 1ª parte. */
  readonly input: FitInput;
  readonly box: ResolvedBox;
  /** Filhos em fluxo de P: os itens que se dividem entre as partes. */
  readonly flow: readonly ResolvedNode[];
}

interface Part {
  readonly result: FitResult;
  readonly items: number;
}

const partInput = (paging: Paging, start: number, end: number, partIndex: number): FitInput => {
  const slide: ResolvedSlide = {
    ...paging.input.slide,
    children: withItems(paging.input.slide.children, paging.box, new Set(paging.flow.slice(start, end))),
  };
  return { ...paging.input, slide, slideIndex: paging.input.slideIndex + partIndex };
};

const contextOf = (paging: Paging, partIndex: number): DiagnosticContext => ({
  size: paging.input.size.name,
  slide: paging.input.slideIndex + partIndex + 1,
});

// Table estourada dentro de P não conta para o box-overflow de P (já foi explicada nela): sem o
// próprio código aqui, a paginação acharia que a parte coube.
const NESTED_OVERFLOWS: ReadonlySet<DiagnosticCode> = new Set(['text-overflow', 'table-overflow', 'text-word-broken', 'out-of-slide']);

// Agrupados trazem os paths individuais: um grupo pode juntar um nó de P com um irmão de fora.
const pathsOf = (diagnostic: Diagnostic): readonly string[] => diagnostic.data?.paths ?? [diagnostic.path];

const isBoxOverflowOf = (diagnostic: Diagnostic, boxPath: string): boolean =>
  diagnostic.code === 'box-overflow' && diagnostic.path === boxPath;

const breaksBox = (diagnostic: Diagnostic, boxPath: string): boolean =>
  pathsOf(diagnostic).some((path) =>
    diagnostic.code === 'box-overflow' ? path === boxPath : NESTED_OVERFLOWS.has(diagnostic.code) && isWithin(path, boxPath),
  );

const fits = (result: FitResult, paging: Paging): boolean =>
  !result.diagnostics.some((diagnostic) => breaksBox(diagnostic, paging.box.path));

const attempt = (paging: Paging, start: number, end: number, partIndex: number): FitResult =>
  fitSlideFrozen(partInput(paging, start, end, partIndex), paging.box.path);

/** Parte com todos os itens restantes e shrink de volta em P (nada cabe sozinho, ou limite de partes). */
const wholePart = (paging: Paging, start: number, partIndex: number): Part => ({
  result: fitSlide(partInput(paging, start, paging.flow.length, partIndex)),
  items: paging.flow.length - start,
});

const limitPart = (paging: Paging, start: number, partIndex: number): Part => {
  const part = wholePart(paging, start, partIndex);
  const boxPath = paging.box.path;
  const { diagnostics } = part.result;
  const stopped = diagnostics.some((diagnostic) => isBoxOverflowOf(diagnostic, boxPath))
    ? diagnostics.map((diagnostic) => (isBoxOverflowOf(diagnostic, boxPath) ? withPaginationStop(diagnostic, MAX_PARTS) : diagnostic))
    : [...diagnostics, paginationLimit(contextOf(paging, partIndex), boxPath, part.items, MAX_PARTS)];
  return { ...part, result: { ...part.result, diagnostics: stopped } };
};

/** Maior k em [low, high] sem estouro em P; `best` é o maior já sabido que cabe. */
const largestFitting = (
  paging: Paging,
  window: { readonly start: number; readonly partIndex: number },
  low: number,
  high: number,
  best: Part | undefined,
): Part | undefined => {
  if (low > high) return best;
  const middle = Math.ceil((low + high) / 2);
  const result = attempt(paging, window.start, window.start + middle, window.partIndex);
  return fits(result, paging)
    ? largestFitting(paging, window, middle + 1, high, { result, items: middle })
    : largestFitting(paging, window, low, middle - 1, best);
};

const partsFrom = (paging: Paging, start: number, partIndex: number): readonly Part[] => {
  const remaining = paging.flow.length - start;
  const whole = attempt(paging, start, paging.flow.length, partIndex);
  if (fits(whole, paging)) return [{ result: whole, items: remaining }];
  if (partIndex + 1 >= MAX_PARTS) return [limitPart(paging, start, partIndex)];
  // k = remaining já foi testado acima.
  const best = largestFitting(paging, { start, partIndex }, 1, remaining - 1, undefined);
  if (best === undefined) return [wholePart(paging, start, partIndex)];
  return [best, ...partsFrom(paging, start + best.items, partIndex + 1)];
};

const announced = (parts: readonly Part[], paging: Paging): readonly FitResult[] => {
  const notice = slideContinued(contextOf(paging, 0), paging.box.path, {
    sourceSlide: paging.input.slide.sourceSlide,
    items: parts.map((part) => part.items),
  });
  return parts.map(({ result }, index) => (index === 0 ? { ...result, diagnostics: [notice, ...result.diagnostics] } : result));
};

// ───────────── M13-5: Text paginate (as linhas continuam no próximo slide) ─────────────

const paginatedTextOf = (nodes: readonly ResolvedNode[]): ResolvedText | undefined =>
  nodes.reduce<ResolvedText | undefined>((found, node) => {
    if (found !== undefined) return found;
    if (node.kind === 'text' && node.props.paginate === true) return node;
    return node.kind === 'box' ? paginatedTextOf(node.children) : undefined;
  }, undefined);

const replaceText = (nodes: readonly ResolvedNode[], text: ResolvedText): readonly ResolvedNode[] =>
  nodes.map((node) => {
    if (node.path === text.path) return text;
    return node.kind === 'box' ? { ...node, children: replaceText(node.children, text) } : node;
  });

const positionedTextOf = (nodes: readonly PositionedNode[], path: string): PositionedText | undefined =>
  nodes.reduce<PositionedText | undefined>((found, node) => {
    if (found !== undefined) return found;
    if (node.kind === 'text' && node.path === path) return node;
    return node.kind === 'box' ? positionedTextOf(node.children, path) : undefined;
  }, undefined);

// Estouro do próprio Text ou de um contêiner que o contém (o Text que cresce empurra o pai).
const TEXT_BREAKS: ReadonlySet<DiagnosticCode> = new Set(['text-overflow', 'box-overflow', 'out-of-slide']);

interface TextPaging {
  readonly input: FitInput;
  readonly text: ResolvedText;
}

const textInput = (paging: TextPaging, runs: readonly TextRun[], partIndex: number): FitInput => ({
  ...paging.input,
  slide: { ...paging.input.slide, children: replaceText(paging.input.slide.children, withRuns(paging.text, runs)) },
  slideIndex: paging.input.slideIndex + partIndex,
});

const textFits = (result: FitResult, path: string): boolean =>
  !result.diagnostics.some((diagnostic) => TEXT_BREAKS.has(diagnostic.code) && pathsOf(diagnostic).some((scope) => isWithin(path, scope)));

interface TextPart {
  readonly result: FitResult;
  readonly lines: number;
}

const linesIn = (result: FitResult, path: string): number => positionedTextOf(result.slide.children, path)?.text.lines.length ?? 0;

/** Maior k em [low, high] cujas k primeiras linhas cabem (o Text congelado no size do autor). */
const largestTextFit = (paging: TextPaging, runs: readonly TextRun[], layout: PositionedText, partIndex: number, low: number, high: number, best: number | undefined): number | undefined => {
  if (low > high) return best;
  const middle = Math.ceil((low + high) / 2);
  const { head } = splitRunsAt(runs, offsetAfterLines(layout.content, layout.text.lines, middle));
  const result = fitSlideFrozen(textInput(paging, head, partIndex), paging.text.path);
  return textFits(result, paging.text.path)
    ? largestTextFit(paging, runs, layout, partIndex, middle + 1, high, middle)
    : largestTextFit(paging, runs, layout, partIndex, low, middle - 1, best);
};

const textPartsFrom = (paging: TextPaging, runs: readonly TextRun[], partIndex: number): readonly TextPart[] => {
  const path = paging.text.path;
  const whole = fitSlideFrozen(textInput(paging, runs, partIndex), path);
  if (textFits(whole, path)) return [{ result: whole, lines: linesIn(whole, path) }];
  // No limite de partes (ou se nem uma linha cabe), o resto fica numa parte só, com o fit normal (pode encolher).
  const lastPart = (): readonly TextPart[] => {
    const result = fitSlide(textInput(paging, runs, partIndex));
    return [{ result, lines: linesIn(result, path) }];
  };
  const layout = positionedTextOf(whole.slide.children, path);
  if (layout === undefined || partIndex + 1 >= MAX_PARTS) return lastPart();
  const fitting = largestTextFit(paging, runs, layout, partIndex, 1, layout.text.lines.length - 1, undefined);
  if (fitting === undefined) return lastPart();
  const cut = cutLineOf(layout.text.paragraphs, fitting);
  const { head, tail } = splitRunsAt(runs, offsetAfterLines(layout.content, layout.text.lines, cut));
  const first = fitSlideFrozen(textInput(paging, head, partIndex), path);
  const part = { result: first, lines: linesIn(first, path) };
  return tail.length === 0 ? [part] : [part, ...textPartsFrom(paging, tail, partIndex + 1)];
};

const paginateText = (input: FitInput, text: ResolvedText): readonly FitResult[] => {
  const paging: TextPaging = { input, text };
  const parts = textPartsFrom(paging, text.runs, 0);
  if (parts.length === 1) return parts.map((part) => part.result);
  const notice = slideContinued({ size: input.size.name, slide: input.slideIndex + 1 }, text.path, {
    sourceSlide: input.slide.sourceSlide,
    items: parts.map((part) => part.lines),
    kind: 'text',
  });
  return parts.map(({ result }, index) => (index === 0 ? { ...result, diagnostics: [notice, ...result.diagnostics] } : result));
};

// ───────────── M14-4: Table paginate (as linhas de dados continuam no próximo slide) ─────────────

const paginatedTableOf = (nodes: readonly ResolvedNode[]): ResolvedTable | undefined =>
  nodes.reduce<ResolvedTable | undefined>((found, node) => {
    if (found !== undefined) return found;
    if (node.kind === 'table' && node.props.paginate === true) return node;
    return node.kind === 'box' ? paginatedTableOf(node.children) : undefined;
  }, undefined);

const replaceTable = (nodes: readonly ResolvedNode[], table: ResolvedTable): readonly ResolvedNode[] =>
  nodes.map((node) => {
    if (node.path === table.path) return table;
    return node.kind === 'box' ? { ...node, children: replaceTable(node.children, table) } : node;
  });

const TABLE_BREAKS: ReadonlySet<DiagnosticCode> = new Set(['table-overflow', 'box-overflow', 'out-of-slide']);

/**
 * Cortes válidos depois de k linhas de dados: nenhum rowSpan que começa antes de k termina depois.
 * `cuts[k]` = true quando dá para cortar ali.
 */
export const tableCutsOf = (table: ResolvedTable): readonly boolean[] => {
  const data = table.grid.slice(table.headerCount);
  const reach = data.map((row, r) => Math.max(r + 1, ...row.map((cell) => (cell.covered ? r + 1 : r + cell.rowSpan))));
  return Array.from({ length: data.length + 1 }, (_, k) => k === 0 || reach.slice(0, k).every((end) => end <= k));
};

/** A tabela só com as linhas de dados [from, to); o cabeçalho vai quando `withHeader`. */
const tableSlice = (table: ResolvedTable, from: number, to: number, withHeader: boolean): ResolvedTable => {
  const header = withHeader ? table.grid.slice(0, table.headerCount) : [];
  const data = table.grid.slice(table.headerCount + from, table.headerCount + to);
  return { ...table, grid: [...header, ...data], headerCount: header.length, rows: table.rows.slice(from, to) };
};

interface TablePaging {
  readonly input: FitInput;
  readonly table: ResolvedTable;
  readonly cuts: readonly boolean[];
  readonly repeatHeader: boolean;
}

const tableInput = (paging: TablePaging, from: number, to: number, partIndex: number): FitInput => {
  const slice = tableSlice(paging.table, from, to, partIndex === 0 || paging.repeatHeader);
  return {
    ...paging.input,
    slide: { ...paging.input.slide, children: replaceTable(paging.input.slide.children, slice) },
    slideIndex: paging.input.slideIndex + partIndex,
  };
};

const tableFits = (result: FitResult, path: string): boolean =>
  !result.diagnostics.some((diagnostic) => TABLE_BREAKS.has(diagnostic.code) && pathsOf(diagnostic).some((scope) => isWithin(path, scope)));

/** Maior corte válido em (from, to) cujas linhas cabem; undefined = nem o menor cabe. */
const largestTableFit = (paging: TablePaging, from: number, partIndex: number, low: number, high: number, best: number | undefined): number | undefined => {
  if (low > high) return best;
  const middle = Math.ceil((low + high) / 2);
  // Desce até um corte válido (não parte rowSpan); se não há nenhum em [low, middle], tenta a metade de cima.
  const valid = Array.from({ length: middle - low + 1 }, (_, i) => middle - i).find((k) => paging.cuts[k] === true);
  if (valid === undefined) return largestTableFit(paging, from, partIndex, middle + 1, high, best);
  const result = fitSlideFrozen(tableInput(paging, from, valid, partIndex), paging.table.path);
  return tableFits(result, paging.table.path)
    ? largestTableFit(paging, from, partIndex, middle + 1, high, valid)
    : largestTableFit(paging, from, partIndex, low, valid - 1, best);
};

interface TablePart {
  readonly result: FitResult;
  readonly rows: number;
}

const tablePartsFrom = (paging: TablePaging, from: number, partIndex: number): readonly TablePart[] => {
  const total = paging.table.rows.length;
  const path = paging.table.path;
  const whole = fitSlideFrozen(tableInput(paging, from, total, partIndex), path);
  if (tableFits(whole, path)) return [{ result: whole, rows: total - from }];
  // No limite de partes (ou se nem a 1ª linha cabe), o resto fica numa parte só, com o fit normal (pode encolher).
  const lastPart = (): readonly TablePart[] => [{ result: fitSlide(tableInput(paging, from, total, partIndex)), rows: total - from }];
  if (partIndex + 1 >= MAX_PARTS) return lastPart();
  const cut = largestTableFit(paging, from, partIndex, from + 1, total - 1, undefined);
  if (cut === undefined) return lastPart();
  const part = { result: fitSlideFrozen(tableInput(paging, from, cut, partIndex), path), rows: cut - from };
  return [part, ...tablePartsFrom(paging, cut, partIndex + 1)];
};

const paginateTable = (input: FitInput, table: ResolvedTable): readonly FitResult[] => {
  const paging: TablePaging = { input, table, cuts: tableCutsOf(table), repeatHeader: table.props.repeatHeader !== false };
  const parts = tablePartsFrom(paging, 0, 0);
  if (parts.length === 1) return parts.map((part) => part.result);
  const notice = slideContinued({ size: input.size.name, slide: input.slideIndex + 1 }, table.path, {
    sourceSlide: input.slide.sourceSlide,
    items: parts.map((part) => part.rows),
    kind: 'table',
  });
  return parts.map(({ result }, index) => (index === 0 ? { ...result, diagnostics: [notice, ...result.diagnostics] } : result));
};

/**
 * Ajuste de um slide do autor, que pode virar várias partes. Sem nó paginate é o
 * `fitSlide` de sempre; com ele (Box: itens; Text: linhas), uma parte só quando tudo cabe (ou nada cabe).
 */
export const paginateSlide = (input: FitInput): readonly FitResult[] => {
  const text = paginatedTextOf(input.slide.children);
  if (text !== undefined) return paginateText(input, text);
  const table = paginatedTableOf(input.slide.children);
  if (table !== undefined) return paginateTable(input, table);
  const box = paginatedBoxOf(input.slide.children);
  if (box === undefined) return [fitSlide(input)];
  const paging: Paging = { input, box, flow: box.children.filter((child) => !isAbsolute(child)) };
  const parts = partsFrom(paging, 0, 0);
  return parts.length === 1 ? parts.map((part) => part.result) : announced(parts, paging);
};
