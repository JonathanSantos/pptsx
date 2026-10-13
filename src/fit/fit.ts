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
import { detectOverflow } from './detect.ts';
import type { Overflow } from './detect.ts';
import { boxOverflow, fontMissing, imageUpscaled, outOfSlide, textTruncated } from './diagnostics.ts';
import type { DiagnosticContext } from './diagnostics.ts';
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

/** Um passo: em cada escopo com Text estourado, todos os Text que podem encolher descem juntos. */
const shrinkStep = (pass: Pass, plans: Plans): ReadonlyMap<string, TextPatch> => {
  const scopes = [...textOverflowsOf(pass).keys()]
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
    positionedNodes(pass.positioned.children)
      .filter(isPositionedText)
      .map((text) => [text.path, plans.get(text.path)?.policy.settle(text, overflows.get(text.path))] as const),
  );
  return patches.size === 0 ? pass : passOf(patchTexts(pass.resolved, patches), input);
};

const textDiagnostics = (text: PositionedText, plan: TextPlan, overflow: Overflow | undefined, ctx: DiagnosticContext) => [
  ...plan.policy.diagnose(
    { text, overflow, from: plan.from, to: textStyleOf(text.props).size, min: plan.min, maxSteps: DEFAULTS.maxFitIterations },
    ctx,
  ),
  ...(text.text.truncated ? [textTruncated(ctx, text.path, text.text.lines.length)] : []),
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
    return plan === undefined ? [] : textDiagnostics(text, plan, overflows.get(text.path), ctx);
  });
  const boxes = pass.overflows.filter((overflow) => overflow.kind === 'box').map((overflow) => boxOverflow(ctx, overflow));
  const outside = pass.overflows.filter((overflow) => overflow.kind === 'slide').map((overflow) => outOfSlide(ctx, overflow));
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
