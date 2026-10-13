import type { Diagnostic, Pt, TextStyle } from '../core/types.ts';
import type { Overflow } from './detect.ts';

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
    : `Texto estourou ${amount(overflow)} da altura disponível em ${round(sizes.to)} pt: o ajuste parou após ${sizes.maxSteps} passos, ainda acima do mínimo de ${round(sizes.min)} pt; reduza o conteúdo, aumente a área ou use um size inicial menor.`;
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

export const textTruncated = (ctx: DiagnosticContext, path: string, lines: number): Diagnostic =>
  make(ctx, {
    severity: 'warning',
    code: 'text-truncated',
    path,
    message: `Texto cortado em ${lines} ${lines === 1 ? 'linha' : 'linhas'} com reticências; parte do conteúdo não aparece. Encurte o conteúdo, aumente a área, aumente maxLines ou use fit="shrink".`,
  });

export const fontMissing = (ctx: DiagnosticContext, path: string, style: TextStyle): Diagnostic => {
  const face = `${style.family} ${style.weight}${style.italic ? ' italic' : ''}`;
  return make(ctx, {
    severity: 'error',
    code: 'font-missing',
    path,
    message: `Fonte "${face}" não está registrada; o texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a fonte em options.fonts ou use uma família registrada.`,
  });
};

export const boxOverflow = (ctx: DiagnosticContext, overflow: Overflow): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'box-overflow',
    path: overflow.path,
    message: `Os filhos passam ${amount(overflow)} da área de conteúdo do contêiner; reduza width/height fixos, gap ou padding, permita shrink nos filhos ou aumente o contêiner.`,
    data: overflowData(overflow),
  });

export const outOfSlide = (ctx: DiagnosticContext, overflow: Overflow): Diagnostic =>
  make(ctx, {
    severity: 'error',
    code: 'out-of-slide',
    path: overflow.path,
    message: `O elemento sai ${round(overflow.overflowPt)} pt para fora do slide; reduza o tamanho ou o conteúdo ao redor. Se for decoração intencional, use position="absolute".`,
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
