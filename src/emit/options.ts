import { basename } from 'node:path';
import type * as Pptx from './pptx.ts';
import { resolveAssetPath } from '../core/assets.ts';
import { DEFAULTS, imageFitOf, strokeColorOf, textStyleOf } from '../core/defaults.ts';
import type {
  Color,
  LineBreaks,
  PositionedImage,
  PositionedShape,
  PositionedSlide,
  PositionedText,
  Rect,
  ShapeKind,
  ShapeProps,
  StrokeProps,
} from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { ACTIVE_LINE_SPACING, lineSpacingOf, type LineSpacingStrategy } from './calibration.ts';
import { dashOf } from './line-style.ts';
import { hyperlinkOf } from './link.ts';
import { hexOf, textRunsOfNode } from './runs.ts';

/**
 * Funções puras: nó posicionado → opções do pptxgenjs. Nenhuma toca a
 * instância do pptx, então são testáveis isoladamente. Aqui fica o conteúdo
 * de cada nó (texto, imagem, shape); a pintura CSS da caixa (fundo, bordas,
 * sombra, opacidade, rotação) fica em decoration.ts.
 */

export interface InchPosition {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ShapeSpec {
  readonly shape: Pptx.ShapeName;
  readonly options: Pptx.ShapeProps;
}

export interface TextSpec {
  readonly runs: Pptx.TextProps[];
  readonly options: Pptx.TextPropsOptions;
}

const DEBUG_OUTLINE = { color: 'FF0000', width: 0.5, dashType: 'dash' } as const;

/** `prstGeom` de cada kind (DEFAULTS.shape.pptx); os nomes são os do enum do pptxgenjs. */
const shapeNameOf = (kind: ShapeKind): Pptx.ShapeName => DEFAULTS.shape.pptx[kind].prst as Pptx.ShapeName;

export { hexOf };

export const positionOf = (frame: Rect): InchPosition => ({
  x: ptToInches(frame.x),
  y: ptToInches(frame.y),
  w: ptToInches(frame.width),
  h: ptToInches(frame.height),
});

/** Sem fill, omitimos a chave: o pptxgenjs só escreve <a:noFill/> quando ela não existe. */
const fillOf = (fill: Color | undefined): { readonly fill?: Pptx.ShapeFillProps } =>
  fill === undefined ? {} : { fill: { type: 'solid', color: hexOf(fill) } };

const lineOf = (props: StrokeProps): Pptx.ShapeLineProps | undefined => {
  if (props.stroke === undefined) return undefined;
  return { color: hexOf(props.stroke), width: props.strokeWidth ?? DEFAULTS.strokeWidth };
};

/** Pontas de seta (só em line; o resolve garante): omitidas quando 'none'. */
const arrowsOf = (props: ShapeProps): Pick<Pptx.ShapeLineProps, 'beginArrowType' | 'endArrowType'> => ({
  ...(props.startArrow === undefined || props.startArrow === 'none' ? {} : { beginArrowType: props.startArrow }),
  ...(props.endArrow === undefined || props.endArrow === 'none' ? {} : { endArrowType: props.endArrow }),
});

/** Linha do contorno da forma: cor/espessura, tracejado e setas. */
const shapeLineOf = (props: ShapeProps): Pptx.ShapeLineProps | undefined => {
  const line = lineOf(props);
  return line === undefined ? undefined : { ...line, ...dashOf(props.lineStyle), ...arrowsOf(props) };
};

/**
 * pptxgenjs v4 interpreta rectRadius em POLEGADAS (adj = r·EMU·100000 / min(w,h)),
 * apesar do .d.ts dizer 0–1. Limitamos a metade do menor lado, que é o máximo
 * geométrico do roundRect.
 */
export const rectRadiusOf = (radius: number, frame: Rect): number =>
  ptToInches(Math.min(radius, Math.min(frame.width, frame.height) / 2));

/**
 * Geometria do prstGeom: `roundRect` leva o raio do autor; `pill` é um roundRect com raio = metade
 * do menor lado (adj 50000). As demais kinds saem sem avLst (os ajustes padrão do OOXML).
 */
export const geometryOf = (kind: ShapeKind, radius: number | undefined, frame: Rect): { readonly shape: Pptx.ShapeName; readonly rectRadius?: number } => {
  const shape = shapeNameOf(kind);
  if (kind === 'pill') return { shape, rectRadius: rectRadiusOf(Math.min(frame.width, frame.height) / 2, frame) };
  if (kind !== 'roundRect' || !radius || radius <= 0) return { shape };
  return { shape, rectRadius: rectRadiusOf(radius, frame) };
};

const flipsOf = (props: ShapeProps): Pick<Pptx.ShapeProps, 'flipH' | 'flipV'> => ({
  ...(props.flipH === true ? { flipH: true } : {}),
  ...(props.flipV === true ? { flipV: true } : {}),
});

/** Shape 'line' usa o próprio frame: pptxgenjs desenha da quina sup. esq. à inf. dir. (flip espelha). */
export const shapeOf = (node: PositionedShape): ShapeSpec => {
  const props = { ...node.props, stroke: strokeColorOf(node.props) };
  const line = shapeLineOf(props);
  const { shape, rectRadius } = geometryOf(props.kind, props.radius, node.frame);
  return {
    shape,
    options: {
      ...positionOf(node.frame),
      ...fillOf(props.fill),
      ...(line ? { line } : {}),
      ...(rectRadius === undefined ? {} : { rectRadius }),
      ...flipsOf(props),
    },
  };
};

export const textOf = (
  node: PositionedText,
  lineSpacing: LineSpacingStrategy = ACTIVE_LINE_SPACING,
  lang: string = DEFAULTS.lang,
  lineBreaks: LineBreaks = DEFAULTS.lineBreaks,
): TextSpec => ({
  runs: textRunsOfNode(node, lineBreaks),
  options: {
    ...positionOf(node.frame),
    margin: 0,
    valign: 'top',
    // fit 'none' e paraSpace 0 não geram XML (o pptxgenjs descarta falsy e
    // trata 'none' como ausência). Fica correto mesmo assim: shape sem
    // placeholder herda otherStyle/defaultTextStyle, que não têm spcBef/
    // spcAft nem autofit, e o padrão OOXML é espaço 0 e sem autofit.
    fit: 'none',
    // nowrap vira wrap="none" no <a:bodyPr>: senão o renderizador requebra a linha que
    // estourou (M8-H, R20) e o estouro vai para baixo em vez de para a lateral.
    wrap: node.props.nowrap !== true,
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    ...lineSpacingOf(node, lineSpacing),
    // bold/italic/color vão em cada run (ver pptxRunOf em runs.ts), não na caixa.
    fontFace: textStyleOf(node.props).family,
    fontSize: node.text.fontSize,
    align: node.props.align ?? DEFAULTS.text.align,
    lang,
  },
});

/**
 * Com sizing, o pptxgenjs usa w/h só como proporção da imagem original
 * (e trata número ≥ 100 como EMU), então passamos a proporção intrínseca
 * escalada para a largura do frame; o tamanho final vem de sizing.
 */
export const imageOf = (node: PositionedImage, baseDir: string): Pptx.ImageProps => {
  const box = positionOf(node.frame);
  const { width, height } = node.intrinsic;
  const ratio = width > 0 && height > 0 ? height / width : box.h / box.w;
  return {
    path: resolveAssetPath(baseDir, node.props.src),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.w * ratio,
    sizing: { type: imageFitOf(node.props), w: box.w, h: box.h },
    // Sem isso o pptxgenjs grava o caminho absoluto local como texto alternativo.
    altText: basename(node.props.src),
    ...hyperlinkOf(node.props.href),
  };
};

/** M12: PNG do ícone raster como `data:` na área desenhada. */
export const iconImageOf = (png: Buffer, rect: Rect): Pptx.ImageProps => ({
  data: `image/png;base64,${png.toString('base64')}`,
  ...positionOf(rect),
  altText: 'ícone',
});

export const debugOutlineOf = (frame: Rect): ShapeSpec => ({
  shape: 'rect',
  options: { ...positionOf(frame), line: { ...DEBUG_OUTLINE } },
});

export const backgroundOf = (slide: PositionedSlide, baseDir: string): Pptx.BackgroundProps | undefined => {
  const { background } = slide.props;
  if (background === undefined) return undefined;
  if (typeof background === 'string') return { color: hexOf(background) };
  return { path: resolveAssetPath(baseDir, background.image) };
};
