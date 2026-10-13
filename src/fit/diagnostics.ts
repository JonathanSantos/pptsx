import type { Diagnostic, Pt, TextStyle } from '../core/types.ts';
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

/** shrink que chegou ao mínimo (ou ao limite de passos) e ainda estoura. */
export const textOverflowShrunk = (
  ctx: DiagnosticContext,
  overflow: Overflow,
  sizes: { readonly from: Pt; readonly to: Pt; readonly min: Pt; readonly maxSteps: number },
): Diagnostic => {
  const atMin = sizes.to <= sizes.min;
  const message = atMin
    ? `Texto estourou ${amount(overflow)} da altura disponível mesmo em ${round(sizes.to)} pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize.`
    : `Texto estourou ${amount(overflow)} da altura disponível em ${round(sizes.to)} pt: o ajuste parou após ${sizes.maxSteps} passos, ainda acima do mínimo de ${round(sizes.min)} pt; reduza o conteúdo, aumente a área ou use um size inicial menor (se o texto vem de um componente pronto, passe um size menor a ele ou componha o trecho com primitivas Box/Text).`;
  return make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message,
    data: { ...overflowData(overflow), fromSize: round(sizes.from), toSize: round(sizes.to) },
  });
};

export const textOverflowKept = (ctx: DiagnosticContext, overflow: Overflow, size: Pt): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: `Texto estourou ${amount(overflow)} da altura disponível em ${round(size)} pt (fit="error" não ajusta); reduza o conteúdo, aumente a área ou troque para fit="shrink" ou fit="truncate".`,
    data: overflowData(overflow),
  });

/** Sobra depois de truncar: nem uma linha cabe na caixa. */
export const textOverflowTruncated = (ctx: DiagnosticContext, overflow: Overflow): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'text-overflow',
    path: overflow.path,
    message: `Texto estourou ${amount(overflow)} da altura disponível mesmo truncado; a área não comporta nem uma linha. Aumente a área, reduza o size ou remova o texto.`,
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
    message: `${plural ? 'Palavras partidas' : 'Palavra partida'} no meio por falta de largura: ${quoted(broken.words)} não ${plural ? 'cabem' : 'cabe'} inteira${plural ? 's' : ''} numa linha de ${round(broken.width)} pt ${sizes}. Encurte a palavra/valor (abrevie, ex.: "R$ 52,4 mi"), alargue a área (menos colunas, grow, width maior) ou reduza o size.`,
    data: { fromSize: round(broken.from), toSize: round(broken.to) },
  });
};

export const fontMissing = (ctx: DiagnosticContext, path: string, style: TextStyle): Diagnostic => {
  const face = `${style.family} ${style.weight}${style.italic ? ' italic' : ''}`;
  return make(ctx, {
    severity: 'error',
    code: 'font-missing',
    path,
    message: `Fonte "${face}" não está registrada; o texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a fonte em options.fonts ou use uma família registrada.`,
  });
};

const AXIS_NAME = { width: 'horizontal', height: 'vertical' } as const;

const isMainAxis = (excess: ContainerExcess): boolean =>
  (excess.direction === 'row') === (excess.axis === 'width');

/** "somam 812 pt na horizontal (row)" no eixo principal; no cruzado é o maior filho. */
const describeUse = (excess: ContainerExcess): string => {
  const used = round(excess.available + excess.pt);
  const axis = AXIS_NAME[excess.axis];
  return isMainAxis(excess)
    ? `Os filhos em fluxo somam ${used} pt na ${axis} (${excess.direction})`
    : `O maior filho em fluxo ocupa ${used} pt na ${axis} (eixo cruzado da ${excess.direction})`;
};

export const boxOverflow = (ctx: DiagnosticContext, overflow: Overflow, excess: ContainerExcess): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'box-overflow',
    path: overflow.path,
    message: `${describeUse(excess)}, mas a área de conteúdo tem ${round(excess.available)} pt: estouro de ${round(overflow.overflowPt)} pt (${round(overflow.overflowPct)}%). Reduza width/height fixos ou gap/padding, permita shrink nos filhos (shrink={0} impede), ou aumente o contêiner.`,
    data: overflowData(overflow),
  });

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
