// PoC CSS: cópia de src/fit/fit.ts com os tipos da PoC (nós com css); adaptações marcadas com 'PoC:'.
import { DEFAULTS, PT_PER_PX, imageFitOf, textStyleOf } from '../../../src/core/defaults.ts';
import type {
  Diagnostic,
  LayoutEnv,
  PositionedImage,
  PositionedNode,
  PositionedSlide,
  PositionedTable,
  PositionedText,
  Pt,
  ResolvedSlide,
  SlideSize,
} from '../types.ts';
import { measureInputOf } from '../layout/index.ts';
import { brokenWordsOf } from '../../../src/text/index.ts';
import { attributeCauses } from './cause.ts';
import type { Overflow } from './detect.ts';
import { boxOverflow, fontMissing, imageUpscaled, outOfSlide, textTruncated, textWordBroken } from './diagnostics.ts';
import type { DiagnosticContext } from './diagnostics.ts';
import { containerExcessOf, sidesOutside } from './geometry.ts';
import type { Container } from './geometry.ts';
import { groupDiagnostics } from './group.ts';
import {
  explainedPaths,
  passOf,
  plansOf,
  positionedNodes,
  positionedTexts,
  tableOverflowsOf,
  textOverflowsOf,
  widthOverflowsOf,
} from './pass.ts';
import type { Pass, Plans, ShrinkPlan } from './pass.ts';
import { patchTexts } from './rewrite.ts';
import type { TextPatch } from './rewrite.ts';
import { isWithin } from './scope.ts';
import { shrinkRounds } from './search.ts';
import { tableDiagnostics } from './table.ts';

export interface FitInput {
  readonly slide: ResolvedSlide;
  readonly slideIndex: number;
  readonly size: SlideSize;
  readonly env: LayoutEnv;
}

export interface FitResult {
  readonly slide: PositionedSlide;
  readonly diagnostics: readonly Diagnostic[];
}

// Imagens trazem px CSS (96 por polegada).

const isPositionedText = (node: PositionedNode): node is PositionedText => node.kind === 'text';
const isPositionedTable = (node: PositionedNode): node is PositionedTable => node.kind === 'table';
const isContainer = (node: PositionedNode | PositionedSlide): node is Container => node.kind === 'box' || node.kind === 'slide';
const isPositionedImage = (node: PositionedNode): node is PositionedImage => node.kind === 'image';

const patchesOf = (entries: readonly (readonly [string, TextPatch | undefined])[]): ReadonlyMap<string, TextPatch> =>
  new Map(entries.filter((entry): entry is readonly [string, TextPatch] => entry[1] !== undefined));

const settle = (pass: Pass, plans: Plans, input: FitInput): Pass => {
  const overflows = textOverflowsOf(pass);
  const patches = patchesOf(
    positionedTexts(pass).map((text) => [text.path, plans.get(text.path)?.policy.settle(text, overflows.get(text.path))] as const),
  );
  return patches.size === 0 ? pass : passOf(patchTexts(pass.resolved, patches), input);
};

/** Linhas mostradas contra as do texto inteiro, medido sem maxLines na mesma largura (mesmos runs e nowrap). */
const truncationOf = (text: PositionedText, env: LayoutEnv) => ({
  shown: text.text.lines.length,
  total: env.measureText({ ...measureInputOf(text, text.frame.width), maxLines: undefined }).lines.length,
});

const wordBrokenDiagnostics = (text: PositionedText, plan: ShrinkPlan, ctx: DiagnosticContext): readonly Diagnostic[] => {
  if (!text.text.wordBroken) return [];
  const words = brokenWordsOf(text.content, text.text.paragraphs);
  const to = textStyleOf(text.props).size;
  return [textWordBroken(ctx, text.path, { words, from: plan.from, to, width: text.frame.width })];
};

interface TextOverflows {
  readonly height: Overflow | undefined;
  readonly width: Overflow | undefined;
}

// Fonte ausente: a medição é estimada, então estouro, shrink e palavra partida seriam ruído.
const textDiagnostics = (
  text: PositionedText,
  plan: ShrinkPlan,
  overflows: TextOverflows,
  ctx: DiagnosticContext,
  env: LayoutEnv,
): readonly Diagnostic[] => {
  if (text.text.fontMissing) return [fontMissing(ctx, text.path, textStyleOf(text.props))];
  const outcome = {
    text,
    overflow: overflows.height,
    widthOverflow: overflows.width,
    from: plan.from,
    to: textStyleOf(text.props).size,
    min: plan.min,
  };
  return [
    ...plan.policy.diagnose(outcome, ctx),
    ...(text.text.truncated ? [textTruncated(ctx, text.path, truncationOf(text, env))] : []),
    ...wordBrokenDiagnostics(text, plan, ctx),
  ];
};

/** Largura desenhada da imagem dentro do frame, conforme contain/cover. */
const drawnWidthOf = (image: PositionedImage): Pt => {
  const { width, height } = image.intrinsic;
  const scaleX = image.frame.width / width;
  const scaleY = image.frame.height / height;
  const scale = imageFitOf(image.props) === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  return width * scale;
};

const imageDiagnostic = (image: PositionedImage, ctx: DiagnosticContext): readonly Diagnostic[] => {
  const { width } = image.intrinsic;
  if (width <= 0 || image.intrinsic.height <= 0) return [];
  const natural = width * PT_PER_PX;
  const drawn = drawnWidthOf(image);
  return drawn - natural > DEFAULTS.fit.epsilon ? [imageUpscaled(ctx, image.path, { width: drawn, natural, pixels: width })] : [];
};

const diagnosticsOf = (pass: Pass, plans: Plans, input: FitInput): readonly Diagnostic[] => {
  const ctx: DiagnosticContext = { size: input.size.name, slide: input.slideIndex + 1 };
  const heights = textOverflowsOf(pass);
  const widths = widthOverflowsOf(pass);
  const tables = tableOverflowsOf(pass);
  const nodes = positionedNodes(pass.positioned.children);
  // Text e Table na ordem do slide.
  const leaves = nodes.flatMap((node) => {
    const plan = plans.get(node.path);
    if (plan === undefined) return [];
    if (isPositionedTable(node)) return tableDiagnostics(node, plan, tables.get(node.path), ctx);
    if (!isPositionedText(node)) return [];
    return textDiagnostics(node, plan, { height: heights.get(node.path), width: widths.get(node.path) }, ctx, input.env);
  });
  const explained = explainedPaths(pass);
  const byPath = new Map<string, PositionedNode | PositionedSlide>([
    [pass.positioned.path, pass.positioned],
    ...nodes.map((node) => [node.path, node] as const),
  ]);
  const boxes = pass.overflows.filter((overflow) => overflow.kind === 'box').flatMap((overflow) => {
    const container = byPath.get(overflow.path);
    return container === undefined || !isContainer(container) ? [] : [boxOverflow(ctx, overflow, containerExcessOf(container, explained))];
  });
  const outside = pass.overflows.filter((overflow) => overflow.kind === 'slide').flatMap((overflow) => {
    const node = byPath.get(overflow.path);
    return node === undefined ? [] : [outOfSlide(ctx, overflow, sidesOutside(node.frame, pass.positioned.frame))];
  });
  const images = nodes.filter(isPositionedImage).flatMap((image) => imageDiagnostic(image, ctx));
  return [...leaves, ...boxes, ...outside, ...images];
};

/** Planos que podem encolher: os Text/Table dentro do escopo congelado ficam com o size do autor. */
const shrinkablePlans = (plans: Plans, frozenScope: string | undefined): Plans =>
  frozenScope === undefined ? plans : new Map([...plans].filter(([path]) => !isWithin(path, frozenScope)));

/**
 * Loop de ajuste: layout → detectar → por escopo disparado, busca binária do menor
 * delta de shrink (um layout por tentativa) → repetir em rodadas até nada disparar.
 * A bisseção troca os N layouts do passo de 1 pt por ~log2(N), e o piso pela palavra
 * partida pula direto ao size em que ela cabe. Depois: truncate + relayout final,
 * diagnósticos, causa (quem tomou o espaço) e agrupamento de irmãos iguais.
 *
 * `frozenScope` (interno, paginação): os Text/Table dentro dele não disparam nem entram em
 * busca de shrink; truncate e diagnósticos continuam valendo para eles.
 */
export const fitSlideFrozen = (input: FitInput, frozenScope: string | undefined): FitResult => {
  const plans = plansOf(input.slide);
  const shrunk = shrinkRounds(passOf(input.slide, input), shrinkablePlans(plans, frozenScope), input, DEFAULTS.maxFitIterations);
  const final = settle(shrunk, plans, input);
  const diagnostics = attributeCauses(diagnosticsOf(final, plans, input), final.positioned, final.overflows);
  return { slide: final.positioned, diagnostics: groupDiagnostics(diagnostics) };
};

export const fitSlide = (input: FitInput): FitResult => fitSlideFrozen(input, undefined);
