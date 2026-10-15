import { DEFAULTS } from '../core/defaults.ts';
import type { Diagnostic, PositionedNode, Pt, TextStyle } from '../core/types.ts';
import type { Overflow } from './detect.ts';
import type { ContainerExcess, Side, SideExcess } from './geometry.ts';

// Fábrica de diagnósticos. As mensagens são lidas por um LLM que vai editar o deck:
// cada uma diz o que aconteceu, quanto, e o que fazer.

export interface DiagnosticContext {
  /** SlideSize.name */
  readonly size: string;
  /** Índice do slide, começando em 1. */
  readonly slide: number;
}

/** 1 casa decimal, sem ".0" sobrando. */
export const round = (value: number): number => Math.round(value * 10) / 10;

const amount = (overflow: Overflow): string => `${round(overflow.overflowPct)}% (${round(overflow.overflowPt)} pt)`;

const overflowData = (overflow: Overflow) => ({
  overflowPt: round(overflow.overflowPt),
  overflowPct: round(overflow.overflowPct),
});

const make = (
  ctx: DiagnosticContext,
  fields: Pick<Diagnostic, 'severity' | 'code' | 'path' | 'message'> & Pick<Partial<Diagnostic>, 'data'>,
): Diagnostic => ({ size: ctx.size, slide: ctx.slide, ...fields });

export const textShrunk = (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt): Diagnostic =>
  make(ctx, {
    severity: 'info',
    code: 'text-shrunk',
    path,
    message: `Texto reduzido de ${round(fromSize)} pt para ${round(toSize)} pt para caber na área. Se a redução incomodar, encurte o conteúdo ou aumente a área.`,
    data: { fromSize: round(fromSize), toSize: round(toSize) },
  });

/**
 * shrink que ainda estoura. A busca só desiste no mínimo; acima dele só sobra o caso
 * raro de esgotar as rodadas, que não pede ação diferente do autor.
 */
export const textOverflowShrunk = (
  ctx: DiagnosticContext,
  overflow: Overflow,
  sizes: { readonly from: Pt; readonly to: Pt; readonly min: Pt },
): Diagnostic => {
  const where = sizes.to <= sizes.min ? `mesmo em ${round(sizes.to)} pt (mínimo)` : `em ${round(sizes.to)} pt`;
  return make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: `Texto estourou ${amount(overflow)} da altura disponível ${where}; reduza o conteúdo, aumente a área ou baixe minSize.`,
    data: { ...overflowData(overflow), fromSize: round(sizes.from), toSize: round(sizes.to) },
  });
};

const ZERO_AREA_MESSAGE =
  'A área disponível para o texto é 0 pt: o contêiner não deu altura a ele (flexGrow={1} em coluna com altura pelo conteúdo, flexShrink dos irmãos ou height fixo). Remova flexGrow do Text ou dê altura ao contêiner.';

/** Com área 0 pt o conteúdo não é o problema: falar em minSize ou em encurtar desviaria o autor. */
export const withZeroArea = (diagnostic: Diagnostic, available: Pt): Diagnostic =>
  available <= DEFAULTS.fit.epsilon ? { ...diagnostic, message: ZERO_AREA_MESSAGE } : diagnostic;

/** Estouro que só existe porque outro nó tomou o espaço: aponta a causa para o autor corrigir primeiro. */
export const withCause = (diagnostic: Diagnostic, cause: { readonly path: string; readonly demand: Pt }): Diagnostic => ({
  ...diagnostic,
  message: `${diagnostic.message} Esse estouro é consequência: ${cause.path} pede ${round(cause.demand)} pt a mais do que a área tem; corrija ${cause.path} primeiro.`,
  data: { ...diagnostic.data, causedBy: cause.path },
});

/** Irmão de uma linha nowrap que tomou a largura da row: o autor corrige o nowrap primeiro. */
export const withWidthCause = (diagnostic: Diagnostic, cause: { readonly path: string; readonly overflowPt: Pt }): Diagnostic => ({
  ...diagnostic,
  message: `${diagnostic.message} Esse estouro é consequência: ${cause.path} tem ${round(cause.overflowPt)} pt a mais de largura do que a área tem; corrija ${cause.path} primeiro.`,
  data: { ...diagnostic.data, causedBy: cause.path },
});

export const textIllegible = (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt): Diagnostic =>
  make(ctx, {
    severity: 'warning',
    code: 'text-illegible',
    path,
    message: `Texto reduzido de ${round(fromSize)} pt para ${round(toSize)} pt, abaixo do piso legível de ${DEFAULTS.text.minLegibleSize} pt; encurte o conteúdo, aumente a área ou aceite com minSize explícito.`,
    data: { fromSize: round(fromSize), toSize: round(toSize) },
  });

export const textOverflowKept = (ctx: DiagnosticContext, overflow: Overflow, size: Pt): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: `Texto estourou ${amount(overflow)} da altura disponível em ${round(size)} pt (fit="error" não ajusta); reduza o conteúdo, aumente a área ou troque para fit="shrink" ou fit="truncate".`,
    data: overflowData(overflow),
  });

// nowrap: a linha não quebra, então nem encurtar a altura nem truncar resolvem; a ação é na largura.
const WIDTH_ADVICE = 'encurte o texto, alargue a área ou remova nowrap.';

/** A área é a largura da linha menos o que passou (o mesmo corte usado na detecção). */
const widthMessage = (overflow: Overflow, lineWidth: Pt, where: string): string =>
  `Texto com nowrap tem ${round(lineWidth)} pt de largura numa área de ${round(lineWidth - overflow.overflowPt)} pt ${where}; ${WIDTH_ADVICE}`;

const widthData = (overflow: Overflow) => ({ ...overflowData(overflow), axis: 'width' as const });

/** shrink com nowrap que ainda passa da largura (normalmente já no mínimo). */
export const textOverflowWidthShrunk = (
  ctx: DiagnosticContext,
  overflow: Overflow,
  lineWidth: Pt,
  sizes: { readonly from: Pt; readonly to: Pt; readonly min: Pt },
): Diagnostic => {
  const where = sizes.to <= sizes.min ? `mesmo em ${round(sizes.to)} pt (mínimo)` : `em ${round(sizes.to)} pt`;
  return make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: widthMessage(overflow, lineWidth, where),
    data: { ...widthData(overflow), fromSize: round(sizes.from), toSize: round(sizes.to) },
  });
};

const KEPT_REASON = {
  error: 'fit="error" não ajusta',
  truncate: 'fit="truncate" só corta linhas, não largura',
} as const;

/** Políticas que não encolhem: a largura fica como o autor escreveu. */
export const textOverflowWidthKept = (
  ctx: DiagnosticContext,
  overflow: Overflow,
  lineWidth: Pt,
  size: Pt,
  policy: keyof typeof KEPT_REASON,
): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: widthMessage(overflow, lineWidth, `em ${round(size)} pt (${KEPT_REASON[policy]})`),
    data: widthData(overflow),
  });

/** Sobra depois de truncar: nem uma linha cabe na caixa. */
export const textOverflowTruncated = (ctx: DiagnosticContext, overflow: Overflow): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: `Texto estourou ${amount(overflow)} da altura disponível mesmo truncado; a área não comporta nem uma linha. Aumente a área, reduza o fontSize ou remova o texto.`,
    data: overflowData(overflow),
  });

/** Linhas mostradas (com reticências) contra as linhas do texto inteiro na mesma largura. */
export const textTruncated = (ctx: DiagnosticContext, path: string, lines: { readonly shown: number; readonly total: number }): Diagnostic => {
  const hidden = lines.total > 0 ? Math.round(((lines.total - lines.shown) / lines.total) * 100) : 0;
  return make(ctx, {
    severity: 'warning',
    code: 'text-truncated',
    path,
    message: `Texto cortado com reticências: mostradas ${lines.shown} de ${lines.total} linhas (~${hidden}% do conteúdo oculto). Encurte o conteúdo, aumente a área, aumente maxLines ou use fit="shrink".`,
  });
};

const quoted = (words: readonly string[]): string => words.map((word) => `"${word}"`).join(', ');

/** Palavra quebrada por caractere que sobreviveu ao ajuste (ou que o fit da política não tenta resolver). */
export const textWordBroken = (
  ctx: DiagnosticContext,
  path: string,
  broken: { readonly words: readonly string[]; readonly from: Pt; readonly to: Pt; readonly width: Pt },
): Diagnostic => {
  const plural = broken.words.length > 1;
  const sizes = broken.to < broken.from ? `mesmo reduzido de ${round(broken.from)} pt para ${round(broken.to)} pt` : `em ${round(broken.to)} pt`;
  return make(ctx, {
    severity: 'warning',
    code: 'text-word-broken',
    path,
    message: `${plural ? 'Palavras partidas' : 'Palavra partida'} no meio por falta de largura: ${quoted(broken.words)} não ${plural ? 'cabem' : 'cabe'} inteira${plural ? 's' : ''} numa linha de ${round(broken.width)} pt ${sizes}. Encurte a palavra/valor (abrevie, ex.: "R$ 52,4 mi"), alargue a área (menos colunas, flexGrow, width maior) ou reduza o fontSize.`,
    data: { fromSize: round(broken.from), toSize: round(broken.to) },
  });
};

export const fontMissing = (ctx: DiagnosticContext, path: string, style: TextStyle): Diagnostic => {
  const face = `${style.family} ${style.weight}${style.italic ? ' italic' : ''}`;
  return make(ctx, {
    severity: 'error',
    code: 'font-missing',
    path,
    message: `Fonte "${face}" não foi encontrada: não está em options.fonts, ou foi registrada sem "file" e não existe no sistema. O texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a face com "file", instale a fonte ou use uma família disponível.`,
  });
};

/** M13: peso pedido sem face próxima; o texto sai com a face de `used`. */
export const fontWeightFallback = (ctx: DiagnosticContext, path: string, family: string, weights: { readonly requested: number; readonly used: number }): Diagnostic =>
  make(ctx, {
    severity: 'warning',
    code: 'font-weight-fallback',
    path,
    message: `Peso ${weights.requested} de "${family}" não tem face registrada; o texto sai com a face de peso ${weights.used}. Registre a face desse peso em options.fonts (ex.: { family: "${family}", weight: ${weights.requested}, file: "…" }) ou use um peso disponível.`,
    data: { requestedWeight: weights.requested, usedWeight: weights.used },
  });

/** M14: ícone em célula de tabela é uma forma sobre a tabela, não parte dela. */
export const tableCellIcon = (ctx: DiagnosticContext, path: string): Diagnostic =>
  make(ctx, {
    severity: 'info',
    code: 'table-cell-icon',
    path,
    message: 'Os ícones das células saem como formas sobre a tabela, não dentro dela: se alguém mover ou redimensionar a tabela no PowerPoint, os ícones não acompanham.',
  });

// ───────── Table (M10): mesmos códigos do Text, mensagens próprias (o autor age em linhas/colunas/células).

const TABLE_ADVICE = 'Reduza linhas/colunas, encurte o texto das células, aumente a área';

export interface TableRows {
  /** Linhas de dados inteiramente visíveis (o cabeçalho não conta). */
  readonly shown: number;
  readonly total: number;
}

/** "4 de 6 linhas cabem inteiras" / "1 de 6 linhas cabe inteira" */
const describeRows = (rows: TableRows): string => {
  const noun = rows.total === 1 ? 'linha' : 'linhas';
  const fits = rows.shown === 1 ? 'cabe inteira' : 'cabem inteiras';
  return `${rows.shown} de ${rows.total} ${noun} ${fits}`;
};

const tableAmount = (overflow: Overflow): string => `${round(overflow.overflowPt)} pt (${round(overflow.overflowPct)}%)`;

const tableOverflowData = (overflow: Overflow, sizes: { readonly from: Pt; readonly to: Pt }, rows: TableRows) => ({
  ...overflowData(overflow),
  fromSize: round(sizes.from),
  toSize: round(sizes.to),
  shownRows: rows.shown,
  totalRows: rows.total,
});

export const tableShrunk = (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt): Diagnostic =>
  make(ctx, {
    severity: 'info',
    code: 'text-shrunk',
    path,
    message: `Tabela reduzida de ${round(fromSize)} pt para ${round(toSize)} pt para caber na área. Se a redução incomodar, encurte o texto das células, reduza linhas/colunas ou aumente a área.`,
    data: { fromSize: round(fromSize), toSize: round(toSize) },
  });

export const tableIllegible = (ctx: DiagnosticContext, path: string, fromSize: Pt, toSize: Pt): Diagnostic =>
  make(ctx, {
    severity: 'warning',
    code: 'text-illegible',
    path,
    message: `Tabela reduzida de ${round(fromSize)} pt para ${round(toSize)} pt, abaixo do piso legível de ${DEFAULTS.text.minLegibleSize} pt; reduza linhas/colunas, encurte o texto das células, aumente a área ou aceite com minSize explícito.`,
    data: { fromSize: round(fromSize), toSize: round(toSize) },
  });

/** shrink que ainda estoura (normalmente já no mínimo; acima dele só se as rodadas acabaram). */
export const tableOverflowShrunk = (
  ctx: DiagnosticContext,
  overflow: Overflow,
  sizes: { readonly from: Pt; readonly to: Pt; readonly min: Pt },
  rows: TableRows,
): Diagnostic => {
  const where = sizes.to <= sizes.min ? `mesmo em ${round(sizes.to)} pt (mínimo)` : `em ${round(sizes.to)} pt`;
  return make(ctx, {
    severity: 'error',
    code: 'table-overflow',
    path: overflow.path,
    message: `Tabela estourou ${tableAmount(overflow)} da altura disponível ${where}: ${describeRows(rows)}. ${TABLE_ADVICE} ou baixe minSize.`,
    data: tableOverflowData(overflow, sizes, rows),
  });
};

export const tableOverflowKept = (ctx: DiagnosticContext, overflow: Overflow, size: Pt, rows: TableRows): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'table-overflow',
    path: overflow.path,
    message: `Tabela estourou ${tableAmount(overflow)} da altura disponível em ${round(size)} pt (fit="error" não ajusta): ${describeRows(rows)}. ${TABLE_ADVICE} ou troque para fit="shrink".`,
    data: tableOverflowData(overflow, { from: size, to: size }, rows),
  });

export interface BrokenColumn {
  /** `columns[c].header` */
  readonly header: string;
  readonly words: readonly string[];
  /** Largura em que as células da coluna quebram (coluna − 2 × cellPadding). */
  readonly width: Pt;
}

/** '"Implementação" não cabe inteira numa linha de 92 pt na coluna "Área"' */
const describeBrokenColumn = (column: BrokenColumn): string => {
  const plural = column.words.length > 1;
  return `${quoted(column.words)} não ${plural ? 'cabem' : 'cabe'} inteira${plural ? 's' : ''} numa linha de ${round(column.width)} pt na coluna "${column.header}"`;
};

/** Palavra de célula quebrada por caractere que sobreviveu ao ajuste. */
export const tableWordBroken = (
  ctx: DiagnosticContext,
  path: string,
  broken: { readonly columns: readonly BrokenColumn[]; readonly from: Pt; readonly to: Pt },
): Diagnostic => {
  const plural = broken.columns.length > 1 || broken.columns.some((column) => column.words.length > 1);
  const sizes =
    broken.to < broken.from ? `mesmo com a tabela reduzida de ${round(broken.from)} pt para ${round(broken.to)} pt` : `em ${round(broken.to)} pt`;
  return make(ctx, {
    severity: 'warning',
    code: 'text-word-broken',
    path,
    message: `${plural ? 'Palavras partidas' : 'Palavra partida'} no meio por falta de largura na tabela: ${broken.columns.map(describeBrokenColumn).join('; ')} ${sizes}. Encurte a palavra/valor (abrevie, ex.: "R$ 52,4 mi"), alargue a coluna (width da coluna, tabela mais larga ou menos colunas) ou reduza o fontSize.`,
    data: { fromSize: round(broken.from), toSize: round(broken.to) },
  });
};

const AXIS_NAME = { width: 'horizontal', height: 'vertical' } as const;

const isMainAxis = (excess: ContainerExcess): boolean =>
  (excess.direction === 'row') === (excess.axis === 'width');

/** "somam 812 pt na horizontal (row)" no eixo principal; no cruzado é o maior filho. */
const describeUse = (excess: ContainerExcess): string => {
  const used = round(excess.available + excess.pt);
  const axis = AXIS_NAME[excess.axis];
  // M11: em grid e em wrap quem ocupa o espaço são as linhas/tracks, não um filho.
  if (excess.layout === 'grid') return `Os tracks do grid ocupam ${used} pt na ${axis}`;
  if (excess.layout === 'wrap' && !isMainAxis(excess)) return `As linhas do wrap ocupam ${used} pt na ${axis}`;
  return isMainAxis(excess)
    ? `Os filhos em fluxo somam ${used} pt na ${axis} (${excess.direction})`
    : `O maior filho em fluxo ocupa ${used} pt na ${axis} (eixo cruzado da ${excess.direction})`;
};

export const boxOverflow = (ctx: DiagnosticContext, overflow: Overflow, excess: ContainerExcess): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'box-overflow',
    path: overflow.path,
    message: `${describeUse(excess)}, mas a área de conteúdo tem ${round(excess.available)} pt: estouro de ${round(overflow.overflowPt)} pt (${round(overflow.overflowPct)}%). Reduza width/height fixos ou gap/padding, permita flexShrink nos filhos (flexShrink={0} impede), ou aumente o contêiner.`,
    data: overflowData(overflow),
  });

/** M11: item de grid maior que a célula (track fixo ou fr que não cresce com o conteúdo). */
export const cellOverflow = (ctx: DiagnosticContext, overflow: Overflow, node: PositionedNode): Diagnostic => {
  const cell = node.cell ?? node.frame;
  return make(ctx, {
    severity: 'error',
    code: 'box-overflow',
    path: overflow.path,
    message: `O item ocupa ${round(node.frame.width)} × ${round(node.frame.height)} pt (com margens), mas a célula do grid tem ${round(cell.width)} × ${round(cell.height)} pt: estouro de ${round(overflow.overflowPt)} pt (${round(overflow.overflowPct)}%). Use um track auto/minmax(auto, …) nessa linha/coluna, reduza o conteúdo ou o tamanho fixo do item.`,
    data: overflowData(overflow),
  });
};

const SIDE_NAME: Readonly<Record<Side, string>> = { top: 'pelo topo', right: 'pela direita', bottom: 'pela base', left: 'pela esquerda' };

const describeSides = (sides: readonly SideExcess[]): string =>
  sides.map(({ side, pt }) => `${round(pt)} pt ${SIDE_NAME[side]}`).join(' e ');

export const outOfSlide = (ctx: DiagnosticContext, overflow: Overflow, sides: readonly SideExcess[]): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'out-of-slide',
    path: overflow.path,
    message: `O elemento sai do slide: ${describeSides(sides)}. Reduza o tamanho dele ou o conteúdo ao redor, ou ajuste top/left. Só se for decoração intencional fora do fluxo, use position="absolute".`,
    data: { overflowPt: round(overflow.overflowPt) },
  });

export const imageUpscaled = (
  ctx: DiagnosticContext,
  path: string,
  drawn: { readonly width: Pt; readonly natural: Pt; readonly pixels: number },
): Diagnostic =>
  make(ctx, {
    severity: 'info',
    code: 'image-upscaled',
    path,
    message: `Imagem desenhada com ${round(drawn.width)} pt de largura, acima do natural (${drawn.pixels} px = ${round(drawn.natural)} pt a 96 dpi); pode sair borrada. Use um arquivo com mais resolução ou reduza a área da imagem.`,
  });

const ordinal = (index: number): string => `${index + 1}º`;

/** "3 de 12 itens no 1º, 5 no 2º, 4 no 3º" (ou linhas, num Text paginate) */
const describeParts = (items: readonly number[], unit: string): string => {
  const total = items.reduce((sum, count) => sum + count, 0);
  return items.map((count, index) => (index === 0 ? `${count} de ${total} ${unit} no 1º` : `${count} no ${ordinal(index)}`)).join(', ');
};

export const slideContinued = (
  ctx: DiagnosticContext,
  path: string,
  pagination: { readonly sourceSlide: number; readonly items: readonly number[]; readonly kind?: 'box' | 'text' | 'table' },
): Diagnostic => {
  const text = pagination.kind === 'text';
  const table = pagination.kind === 'table';
  const advice = text ? 'reduza o fontSize do texto ou encurte-o' : table ? 'reduza o fontSize da tabela ou o cellPadding' : 'reduza o fontSize dos itens ou o conteúdo';
  const unit = text ? 'linhas' : table ? 'linhas da tabela' : 'itens';
  return make(ctx, {
    severity: 'info',
    code: 'slide-continued',
    path,
    message: `Slide ${pagination.sourceSlide} do autor virou ${pagination.items.length} slides (${describeParts(pagination.items, unit)}). Para caber em menos slides, ${advice}.`,
    data: { parts: pagination.items.length, sourceSlide: pagination.sourceSlide, ...(pagination.kind === undefined || pagination.kind === 'box' ? {} : { kind: pagination.kind }) },
  });
};

const paginationStop = (maxParts: number): string =>
  ` A paginação parou em ${maxParts} partes; divida o conteúdo em mais de um slide no deck.`;

/** O box-overflow que o fit já deu em P ganha a frase de parada. */
export const withPaginationStop = (diagnostic: Diagnostic, maxParts: number): Diagnostic => ({
  ...diagnostic,
  message: `${diagnostic.message}${paginationStop(maxParts)}`,
});

/** Sem box-overflow do fit em P (o shrink pode ter feito caber): o limite ainda precisa ser dito ao autor. */
export const paginationLimit = (ctx: DiagnosticContext, path: string, remaining: number, maxParts: number): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'box-overflow',
    path,
    message: `Os ${remaining} itens restantes não couberam numa parte com o fontSize do autor e ficaram todos na última parte (o texto deles pode ter sido reduzido).${paginationStop(maxParts)}`,
  });

export const withSourceSlide = (diagnostic: Diagnostic, sourceSlide: number): Diagnostic => ({
  ...diagnostic,
  data: { ...diagnostic.data, sourceSlide },
});

/** M15: o layout declara placeholders que o 1º slide dele não marca; o PowerPoint mostra a caixa vazia em "Novo slide". */
export const placeholderUnused = (ctx: DiagnosticContext, path: string, layout: string, placeholders: readonly string[]): Diagnostic =>
  make(ctx, {
    severity: 'info',
    code: 'placeholder-unused',
    path,
    message: `O layout "${layout}" declara ${placeholders.map((name) => `"${name}"`).join(', ')} mas nenhum nó do 1º slide dele marca ${placeholders.length > 1 ? 'esses placeholders' : 'esse placeholder'}: no master ${placeholders.length > 1 ? 'eles ficam' : 'ele fica'} sem posição própria (canto do slide). Marque um nó com placeholder="…" ou tire o nome do defineLayout.`,
    data: { layout, placeholders },
  });
