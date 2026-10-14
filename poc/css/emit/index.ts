import { basename } from 'node:path';
import { resolveAssetPath } from '../../../src/core/assets.ts';
import { DEFAULTS } from '../../../src/core/defaults.ts';
import { dispatch, type DispatchTable } from '../../../src/core/dispatch.ts';
import type { LineBreaks } from '../../../src/core/types.ts';
import { lineSpacingOf, type LineSpacingStrategy } from '../../../src/emit/calibration.ts';
import { chartOf } from '../../../src/emit/chart.ts';
import { embedFonts, type EmbeddedFont } from '../../../src/emit/embed.ts';
import { backgroundOf, debugOutlineOf, imageOf, positionOf, shapeOf, type ShapeSpec } from '../../../src/emit/options.ts';
import { PptxGenJS, type Presentation, type Slide as PptxSlide } from '../../../src/emit/pptx.ts';
import { sanitizePptx } from '../../../src/emit/sanitize.ts';
import { tableOf } from '../../../src/emit/table.ts';
import { textStyleOf } from '../../../src/core/defaults.ts';
import { ptToInches } from '../../../src/sizes.ts';
import { contentRectOf } from '../layout/index.ts';
import { paintOrderOf, type PaintItem } from '../paint.ts';
import type { PositionedDeck, PositionedNode, PositionedSlide, PositionedText } from '../types.ts';
import { decorationOf, placedOf, shadowOf, transparencyOf } from './decoration.ts';
import { textRunsOfNode } from './runs.ts';

/**
 * Emissor da PoC: os construtores de opções de src/emit (texto, imagem, shape, gráfico,
 * tabela, fundo) aplicados na ordem de pintura CSS (paint.ts), com a pintura nova por cima:
 * fundo/bordas/sombra da caixa, opacity (transparency em cada forma), rotate e letterSpacing.
 */

export interface EmitOptions {
  readonly debug?: boolean;
  readonly baseDir: string;
  readonly lineSpacing?: LineSpacingStrategy;
  readonly lang?: string;
  readonly lineBreaks?: LineBreaks;
  readonly embedFonts?: readonly EmbeddedFont[];
}

interface EmitContext {
  readonly baseDir: string;
  readonly lineSpacing?: LineSpacingStrategy;
  readonly lang: string;
  readonly lineBreaks: LineBreaks;
}

const addShape = (slide: PptxSlide, spec: ShapeSpec): void => {
  slide.addShape(spec.shape, { ...spec.options });
};

const contentOf = <N extends PositionedNode>(node: N): N => ({ ...node, frame: contentRectOf(node.frame, node.box) });

/** Opções da caixa de texto (src/emit/options.ts textOf) na área de conteúdo, com letterSpacing e opacidade em cada run. */
const emitText = (node: PositionedText, slide: PptxSlide, ctx: EmitContext, item: PaintItem): void => {
  const content = contentOf(node);
  const transparency = transparencyOf(1, item.opacity);
  const spacing = node.css.letterSpacing;
  const runs = textRunsOfNode(content, ctx.lineBreaks).map((run) => ({
    ...run,
    options: {
      ...run.options,
      ...(spacing === 0 ? {} : { charSpacing: spacing }),
      ...(transparency === 0 ? {} : { transparency }),
    },
  }));
  slide.addText(runs, {
    ...placedOf(content.frame, item.rotations),
    margin: 0,
    valign: 'top',
    fit: 'none',
    wrap: node.props.nowrap !== true,
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    ...lineSpacingOf(content, ctx.lineSpacing),
    fontFace: textStyleOf(node.props).family,
    fontSize: node.text.fontSize,
    align: node.props.align ?? DEFAULTS.text.align,
    lang: ctx.lang,
  });
};

type ContentEmitter = DispatchTable<PositionedNode, void, [slide: PptxSlide, ctx: EmitContext, item: PaintItem]>;

const emitters: ContentEmitter = {
  box: () => undefined,
  text: emitText,
  image: (node, slide, ctx, item) => {
    const content = contentOf(node);
    const transparency = transparencyOf(1, item.opacity);
    const { rotate } = placedOf(content.frame, item.rotations);
    slide.addImage({
      ...imageOf(content, ctx.baseDir),
      ...(rotate === undefined ? {} : { rotate }),
      ...(transparency === 0 ? {} : { transparency }),
    });
  },
  shape: (node, slide, _ctx, item) => {
    const spec = shapeOf(node);
    const transparency = transparencyOf(1, item.opacity);
    const fill = spec.options.fill === undefined || transparency === 0 ? spec.options.fill : { ...spec.options.fill, transparency };
    const line = spec.options.line === undefined || transparency === 0 ? spec.options.line : { ...spec.options.line, transparency };
    const shadow = node.css.boxShadow === undefined ? {} : { shadow: shadowOf(node.css.boxShadow, item.opacity) };
    addShape(slide, {
      shape: spec.shape,
      options: { ...spec.options, ...placedOf(node.frame, item.rotations), ...(fill ? { fill } : {}), ...(line ? { line } : {}), ...shadow },
    });
  },
  chart: (node, slide) => {
    const { type, data, options } = structuredClone(chartOf(contentOf(node)));
    slide.addChart(type, data, options);
  },
  table: (node, slide, ctx) => {
    const { rows, options } = structuredClone(tableOf(contentOf(node), ctx));
    slide.addTable(rows, options);
  },
};

/** Imagem de fundo da caixa (cover), entre o fundo e as bordas. */
const emitBackgroundImage = (node: PositionedNode, slide: PptxSlide, ctx: EmitContext, item: PaintItem): void => {
  const src = node.css.backgroundImage;
  if (src === undefined || node.kind === 'image') return;
  const box = positionOf(node.frame);
  slide.addImage({
    path: resolveAssetPath(ctx.baseDir, src),
    ...placedOf(node.frame, item.rotations),
    sizing: { type: 'cover', w: box.w, h: box.h },
    altText: basename(src),
  });
};

const emitItem = (slide: PptxSlide, item: PaintItem, ctx: EmitContext): void => {
  const decoration = decorationOf(item.node, item);
  decoration.under.forEach((spec) => addShape(slide, spec));
  emitBackgroundImage(item.node, slide, ctx, item);
  decoration.over.forEach((spec) => addShape(slide, spec));
  dispatch(emitters, item.node, slide, ctx, item);
};

const debugFramesOf = (items: readonly PaintItem[]) => items.filter((item) => item.node.kind !== 'shape').map((item) => item.node.frame);

const emitSlide = (pptx: Presentation, slide: PositionedSlide, options: EmitOptions): void => {
  const target = pptx.addSlide();
  const ctx: EmitContext = {
    baseDir: options.baseDir,
    lineSpacing: options.lineSpacing,
    lang: options.lang ?? DEFAULTS.lang,
    lineBreaks: options.lineBreaks ?? DEFAULTS.lineBreaks,
  };
  const background = backgroundOf(slide, options.baseDir);
  if (background) target.background = background;
  const items = paintOrderOf(slide);
  items.forEach((item) => emitItem(target, item, ctx));
  if (options.debug) debugFramesOf(items).forEach((frame) => addShape(target, debugOutlineOf(frame)));
  if (slide.props.notes) target.addNotes(slide.props.notes);
};

export const emitPptx = async (deck: PositionedDeck, options: EmitOptions): Promise<Buffer> => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: deck.size.name, width: ptToInches(deck.size.width), height: ptToInches(deck.size.height) });
  pptx.layout = deck.size.name;
  deck.slides.forEach((slide) => emitSlide(pptx, slide, options));
  const output = await pptx.write({ outputType: 'nodebuffer' });
  const sanitized = await sanitizePptx(output as Buffer);
  return embedFonts(sanitized, options.embedFonts ?? []);
};
