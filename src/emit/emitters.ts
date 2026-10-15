import type * as Pptx from './pptx.ts';
import { dispatch, type DispatchTable } from '../core/dispatch.ts';
import type { LineBreaks, PositionedConnector, PositionedNode, Rect } from '../core/types.ts';
import { connectorLabelOf, connectorShapeOf } from './connector.ts';
import { contentRectOf } from '../layout/index.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { chartOf } from './chart.ts';
import {
  backgroundImageOf,
  decorationOf,
  paintedImageOf,
  paintedRunsOf,
  paintedShapeOf,
  placedOf,
} from './decoration.ts';
import { debugOutlineOf, iconImageOf, imageOf, shapeOf, textOf, type ShapeSpec } from './options.ts';
import type { PaintItem } from './paint.ts';
import { tableOf } from './table.ts';
import { slideNumberBoxesOf } from './slide-number.ts';
import { pathOf } from './vector.ts';
import { hyperlinkOf } from './link.ts';
import { iconDrawnRectOf, iconPngOf, iconShapesOf } from './icon.ts';

export interface EmitContext {
  readonly baseDir: string;
  readonly lineSpacing?: LineSpacingStrategy;
  readonly lang?: string;
  readonly lineBreaks?: LineBreaks;
}

/** pptxgenjs muta os objetos de opções; cada chamada recebe uma cópia rasa. */
const addShape = (slide: Pptx.Slide, spec: ShapeSpec): void => {
  slide.addShape(spec.shape, { ...spec.options });
};

/** O conteúdo (texto, imagem, gráfico, tabela) fica na área de conteúdo: frame − borda − padding. */
const contentOf = <N extends PositionedNode>(node: N): N => ({ ...node, frame: contentRectOf(node.frame, node.box) });

// O nó vem primeiro para o `dispatch` inferir os argumentos extras. Box não tem conteúdo
// próprio: a pintura dele é a decoração, e os filhos chegam como PaintItems próprios.
const emitters: DispatchTable<PositionedNode, void, [slide: Pptx.Slide, ctx: EmitContext, item: PaintItem]> = {
  box: () => undefined,
  text: (node, slide, ctx, item) => {
    const content = contentOf(node);
    const { runs, options } = textOf(content, ctx.lineSpacing, ctx.lang, ctx.lineBreaks);
    // M13: "n / total" = o campo numa caixa e o resto noutra (o Keynote apaga texto junto do campo).
    slideNumberBoxesOf(content, runs, options).forEach((box) =>
      slide.addText(paintedRunsOf(box.runs, node.css, item.opacity), { ...box.options, ...placedOf(box.frame, item.rotations) }),
    );
  },
  image: (node, slide, ctx, item) => {
    const content = contentOf(node);
    slide.addImage(paintedImageOf(imageOf(content, ctx.baseDir), content.frame, item));
  },
  shape: (node, slide, _ctx, item) => {
    addShape(slide, paintedShapeOf(shapeOf(node), node, item, { cap: node.props.lineCap }));
  },
  // Gráfico e tabela nativos não giram nem têm opacidade no PPTX (o fit avisa com css-not-emitted).
  // addChart/addTable mutam dados e opções em profundidade (labels, bordas, unidades): cópia funda.
  chart: (node, slide) => {
    const { type, data, options } = structuredClone(chartOf(contentOf(node)));
    // Combo (camadas): o pptxgenjs lê o 2º argumento como as opções (os dados vêm em cada camada).
    if (Array.isArray(type)) slide.addChart(type, options as never);
    else slide.addChart(type, data, options);
  },
  table: (node, slide, ctx) => {
    const { rows, options } = structuredClone(tableOf(contentOf(node), ctx));
    slide.addTable(rows, options);
  },
  path: (node, slide, _ctx, item) => {
    const spec = pathOf(node);
    if (spec !== undefined) addShape(slide, paintedShapeOf(spec, node, item, { cap: node.props.lineCap, join: node.props.lineJoin }));
  },
  icon: (node, slide, _ctx, item) => {
    iconShapesOf(node).forEach(({ spec, path }) =>
      addShape(slide, paintedShapeOf(spec, node, item, { cap: path.lineCap, join: path.lineJoin })),
    );
    const png = iconPngOf(node);
    if (png !== undefined) slide.addImage(paintedImageOf(iconImageOf(png, iconDrawnRectOf(node)), iconDrawnRectOf(node), item));
  },
};

/** Fundo/sombra, imagem de fundo, bordas e, por cima, o conteúdo do nó. */
/**
 * M13: link de um Box = hyperlink no fundo; sem fundo, um retângulo 100 % transparente (clicável no
 * PowerPoint, ao contrário de um shape sem preenchimento) no frame.
 */
const linkedUnder = (under: readonly ShapeSpec[], node: PositionedNode, item: PaintItem): readonly ShapeSpec[] => {
  if (node.kind !== 'box' || node.props.href === undefined) return under;
  const link = hyperlinkOf(node.props.href);
  const [first, ...rest] = under;
  if (first !== undefined) return [{ ...first, options: { ...first.options, ...link } }, ...rest];
  return [{ shape: 'rect', options: { ...placedOf(node.frame, item.rotations), fill: { type: 'solid', color: 'FFFFFF', transparency: 100 }, ...link } }];
};

export const emitItem = (slide: Pptx.Slide, item: PaintItem, ctx: EmitContext): void => {
  const decoration = decorationOf(item.node, item);
  linkedUnder(decoration.under, item.node, item).forEach((spec) => addShape(slide, spec));
  const backgroundImage = backgroundImageOf(item.node, item, ctx.baseDir);
  if (backgroundImage) slide.addImage(backgroundImage);
  decoration.over.forEach((spec) => addShape(slide, spec));
  dispatch(emitters, item.node, slide, ctx, item);
};

/** M12: conectores por cima de todos os nós, na ordem em que foram declarados. */
export const emitConnector = (slide: Pptx.Slide, connector: PositionedConnector, ctx: EmitContext): void => {
  addShape(slide, connectorShapeOf(connector));
  const label = connectorLabelOf(connector, ctx.lineSpacing, ctx.lang, ctx.lineBreaks);
  if (label === undefined) return;
  if (label.background !== undefined) addShape(slide, label.background);
  slide.addText(label.text.runs, { ...label.text.options });
};

/** Frames de Box/Text/Image/Chart/Table na ordem de pintura, para o contorno de debug. */
export const debugFramesOf = (items: readonly PaintItem[]): readonly Rect[] =>
  items.filter((item) => item.node.kind !== 'shape').map((item) => item.node.frame);

export const emitDebugOutlines = (slide: Pptx.Slide, items: readonly PaintItem[]): void => {
  debugFramesOf(items).forEach((frame) => addShape(slide, debugOutlineOf(frame)));
};
