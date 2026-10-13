import { DEFAULTS, PT_PER_PX, fitPolicyOf, imageFitOf, minSizeOf, textStyleOf } from '../core/defaults.ts';
import type {
  Diagnostic,
  LayoutEnv,
  PositionedImage,
  PositionedNode,
  PositionedSlide,
  PositionedText,
  Pt,
  ResolvedNode,
  ResolvedSlide,
  ResolvedText,
  SlideSize,
} from '../core/types.ts';
import { layoutSlide } from '../layout/index.ts';
import { brokenWordsOf } from '../text/index.ts';
import { detectOverflow } from './detect.ts';
import type { Overflow } from './detect.ts';
import { boxOverflow, fontMissing, imageUpscaled, outOfSlide, textTruncated, textWordBroken } from './diagnostics.ts';
import type { DiagnosticContext } from './diagnostics.ts';
import { containerExcessOf, sidesOutside } from './geometry.ts';
import type { Container } from './geometry.ts';
import { POLICIES } from './policies.ts';
import type { OverflowPolicy } from './policies.ts';
import { patchTexts } from './rewrite.ts';
import type { TextPatch } from './rewrite.ts';
import { isWithin, scopeOf } from './scope.ts';

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

/** O que vale para o Text durante todo o ajuste, lido das props ORIGINAIS do autor. */
interface TextPlan {
  readonly from: Pt;
  readonly min: Pt;
  readonly policy: OverflowPolicy;
}

type Plans = ReadonlyMap<string, TextPlan>;

interface Pass {
  readonly resolved: ResolvedSlide;
  readonly positioned: PositionedSlide;
  readonly overflows: readonly Overflow[];
}

// Imagens trazem px CSS (96 por polegada).

const sizeOf = (text: ResolvedText): Pt => textStyleOf(text.props).size;

const resolvedTexts = (nodes: readonly ResolvedNode[]): readonly ResolvedText[] =>
  nodes.flatMap((node) => {
    if (node.kind === 'box') return resolvedTexts(node.children);
    return node.kind === 'text' ? [node] : [];
  });

const positionedNodes = (nodes: readonly PositionedNode[]): readonly PositionedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...positionedNodes(node.children)] : [node]));

const isPositionedText = (node: PositionedNode): node is PositionedText => node.kind === 'text';
const isContainer = (node: PositionedNode | PositionedSlide): node is Container => node.kind === 'box' || node.kind === 'slide';
const isPositionedImage = (node: PositionedNode): node is PositionedImage => node.kind === 'image';

const plansOf = (slide: ResolvedSlide): Plans =>
  new Map(
    resolvedTexts(slide.children).map((text) => [
      text.path,
      { from: sizeOf(text), min: minSizeOf(text.props), policy: POLICIES[fitPolicyOf(text.props)] },
    ]),
  );

const passOf = (resolved: ResolvedSlide, input: FitInput): Pass => {
  const positioned = layoutSlide(resolved, input.size, input.env);
  return { resolved, positioned, overflows: detectOverflow(positioned) };
};

const textOverflowsOf = (pass: Pass): ReadonlyMap<string, Overflow> =>
  new Map(pass.overflows.filter((overflow) => overflow.kind === 'text').map((overflow) => [overflow.path, overflow]));

const patchesOf = (entries: readonly (readonly [string, TextPatch | undefined])[]): ReadonlyMap<string, TextPatch> =>
  new Map(entries.filter((entry): entry is readonly [string, TextPatch] => entry[1] !== undefined));

const positionedTexts = (pass: Pass): readonly PositionedText[] =>
  positionedNodes(pass.positioned.children).filter(isPositionedText);

// Palavra partida por caractere é tão ruim quanto estouro: encolher pode fazê-la caber na linha.
const shrinkTriggersOf = (pass: Pass): readonly string[] => [
  ...new Set([
    ...textOverflowsOf(pass).keys(),
    ...positionedTexts(pass)
      .filter((text) => text.text.wordBroken)
      .map((text) => text.path),
  ]),
];

/** Um passo: em cada escopo com Text estourado ou palavra partida, todos os Text que podem encolher descem juntos. */
const shrinkStep = (pass: Pass, plans: Plans): ReadonlyMap<string, TextPatch> => {
  const scopes = shrinkTriggersOf(pass)
    .filter((path) => plans.get(path)?.policy.triggersShrink === true)
    .map(scopeOf);
  if (scopes.length === 0) return new Map();
  return patchesOf(
    resolvedTexts(pass.resolved.children)
      .filter((text) => scopes.some((scope) => isWithin(text.path, scope)))
      .map((text) => {
        const plan = plans.get(text.path);
        const next = plan?.policy.step(sizeOf(text), plan.min);
        return [text.path, next === undefined ? undefined : { size: next }] as const;
      }),
  );
};

/** Termina sempre: para sem estouro, sem nada que encolher, ou no limite de passos. */
const shrinkLoop = (pass: Pass, plans: Plans, input: FitInput, remaining: number): Pass => {
  if (remaining <= 0) return pass;
  const patches = shrinkStep(pass, plans);
  if (patches.size === 0) return pass;
  return shrinkLoop(passOf(patchTexts(pass.resolved, patches), input), plans, input, remaining - 1);
};

const settle = (pass: Pass, plans: Plans, input: FitInput): Pass => {
  const overflows = textOverflowsOf(pass);
  const patches = patchesOf(
    positionedTexts(pass).map((text) => [text.path, plans.get(text.path)?.policy.settle(text, overflows.get(text.path))] as const),
  );
  return patches.size === 0 ? pass : passOf(patchTexts(pass.resolved, patches), input);
};

/** Linhas mostradas contra as do texto inteiro, medido sem maxLines na mesma largura. */
const truncationOf = (text: PositionedText, env: LayoutEnv) => ({
  shown: text.text.lines.length,
  total: env.measureText({ content: text.content, style: textStyleOf(text.props), maxWidth: text.frame.width }).lines.length,
});

const wordBrokenDiagnostics = (text: PositionedText, plan: TextPlan, ctx: DiagnosticContext): readonly Diagnostic[] => {
  if (!text.text.wordBroken) return [];
  const words = brokenWordsOf(text.content, text.text.paragraphs);
  const to = textStyleOf(text.props).size;
  return [textWordBroken(ctx, text.path, { words, from: plan.from, to, width: text.frame.width })];
};

const textDiagnostics = (
  text: PositionedText,
  plan: TextPlan,
  overflow: Overflow | undefined,
  ctx: DiagnosticContext,
  env: LayoutEnv,
) => [
  ...plan.policy.diagnose(
    { text, overflow, from: plan.from, to: textStyleOf(text.props).size, min: plan.min, maxSteps: DEFAULTS.maxFitIterations },
    ctx,
  ),
  ...(text.text.truncated ? [textTruncated(ctx, text.path, truncationOf(text, env))] : []),
  ...wordBrokenDiagnostics(text, plan, ctx),
  ...(text.text.fontMissing ? [fontMissing(ctx, text.path, textStyleOf(text.props))] : []),
];

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
  const overflows = textOverflowsOf(pass);
  const nodes = positionedNodes(pass.positioned.children);
  const texts = nodes.filter(isPositionedText).flatMap((text) => {
    const plan = plans.get(text.path);
    return plan === undefined ? [] : textDiagnostics(text, plan, overflows.get(text.path), ctx, input.env);
  });
  const byPath = new Map<string, PositionedNode | PositionedSlide>([
    [pass.positioned.path, pass.positioned],
    ...nodes.map((node) => [node.path, node] as const),
  ]);
  const boxes = pass.overflows.filter((overflow) => overflow.kind === 'box').flatMap((overflow) => {
    const container = byPath.get(overflow.path);
    return container === undefined || !isContainer(container) ? [] : [boxOverflow(ctx, overflow, containerExcessOf(container, new Set(overflows.keys())))];
  });
  const outside = pass.overflows.filter((overflow) => overflow.kind === 'slide').flatMap((overflow) => {
    const node = byPath.get(overflow.path);
    return node === undefined ? [] : [outOfSlide(ctx, overflow, sidesOutside(node.frame, pass.positioned.frame))];
  });
  const images = nodes.filter(isPositionedImage).flatMap((image) => imageDiagnostic(image, ctx));
  return [...texts, ...boxes, ...outside, ...images];
};

/**
 * Loop de ajuste: layout → detectar → um passo de shrink por escopo → repetir;
 * depois truncate + relayout final e diagnósticos sobre o resultado final.
 */
export const fitSlide = (input: FitInput): FitResult => {
  const plans = plansOf(input.slide);
  const shrunk = shrinkLoop(passOf(input.slide, input), plans, input, DEFAULTS.maxFitIterations);
  const final = settle(shrunk, plans, input);
  return { slide: final.positioned, diagnostics: diagnosticsOf(final, plans, input) };
};
