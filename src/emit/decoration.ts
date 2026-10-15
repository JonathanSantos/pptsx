import { basename } from 'node:path';
import type * as Pptx from './pptx.ts';
import { resolveAssetPath } from '../core/assets.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { BorderSide, BorderStyle, CssStyle, PositionedNode, Rect, Shadow, ShapeKind, Side } from '../core/types.ts';
import { geometryOf as shapeGeometryOf, hexOf, positionOf, rectRadiusOf, type ShapeSpec } from './options.ts';
import { lineMarkerOf, type LineEnds } from './line-style.ts';
import { placementOf, type PaintItem, type Rotation } from './paint.ts';

/**
 * Pintura CSS (M11) → opções do pptxgenjs. Puro. Fundo, bordas, contorno antigo, sombra,
 * imagem de fundo, opacidade e rotação herdadas; os construtores de conteúdo (texto, imagem,
 * shape, gráfico, tabela) continuam em options.ts/chart.ts/table.ts e recebem isto por cima.
 * O shape do PPTX desenha a linha centrada na borda; a borda CSS fica dentro do border-box,
 * então a forma de uma borda uniforme é o frame recuado em largura/2.
 */

const DASH_TYPES: Readonly<Record<BorderStyle, Pptx.ShapeLineProps['dashType']>> = {
  solid: 'solid',
  dashed: 'dash',
  dotted: 'sysDot',
  none: 'solid',
};

/** 0..100 do PPTX a partir de alpha × opacidade herdada. */
export const transparencyOf = (alpha: number, opacity: number): number =>
  Math.round((1 - alpha * opacity) * DEFAULTS.css.transparencyScale);

const withTransparency = <T extends object>(props: T, alpha: number, opacity: number): T => {
  const transparency = transparencyOf(alpha, opacity);
  return transparency === 0 ? props : { ...props, transparency };
};

/** Posição em polegadas + rotação herdada (o PPTX gira cada forma em torno do próprio centro). */
export const placedOf = (rect: Rect, rotations: readonly Rotation[]) => {
  const { frame, rotate } = placementOf(rect, rotations);
  return { ...positionOf(frame), ...(rotate === 0 ? {} : { rotate }) };
};

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

const isVisible = (side: BorderSide): boolean => side.style !== 'none' && side.width > 0;

const sameSide = (a: BorderSide, b: BorderSide): boolean =>
  a.width === b.width && a.style === b.style && a.color === b.color && a.alpha === b.alpha;

/** Borda igual nos quatro lados (e visível): vira a linha do próprio shape. */
export const uniformBorderOf = (css: CssStyle): BorderSide | undefined => {
  const { top } = css.border;
  if (!isVisible(top)) return undefined;
  return SIDES.every((side) => sameSide(css.border[side], top)) ? top : undefined;
};

/** Lados com borda visível, na ordem top, right, bottom, left. */
export const visibleSidesOf = (css: CssStyle): readonly Side[] => SIDES.filter((side) => isVisible(css.border[side]));

export const insetRect = (frame: Rect, amount: number): Rect => ({
  x: frame.x + amount,
  y: frame.y + amount,
  width: Math.max(0, frame.width - 2 * amount),
  height: Math.max(0, frame.height - 2 * amount),
});

/** O raio da linha recuada: o canto externo continua com `borderRadius`. */
export const insetRadiusOf = (radius: number | undefined, border: BorderSide): number | undefined =>
  radius === undefined ? undefined : Math.max(0, radius - border.width / 2);

/** Imagem de fundo só em caixa; numa Image o `src` já é o conteúdo. */
export const hasBackgroundImage = (node: PositionedNode): boolean =>
  node.css.backgroundImage !== undefined && node.kind !== 'image';

export const shadowOf = (shadow: Shadow, opacity: number): Pptx.ShadowProps => {
  const degrees = Math.atan2(shadow.y, shadow.x) * DEFAULTS.css.radiansToDegrees;
  const turn = DEFAULTS.css.degreesPerTurn;
  return {
    type: 'outer',
    blur: shadow.blur,
    offset: Math.hypot(shadow.x, shadow.y),
    angle: Math.round(((degrees % turn) + turn) % turn),
    color: hexOf(shadow.color),
    opacity: shadow.alpha * opacity,
  };
};

const fillOf = (css: CssStyle, opacity: number): { readonly fill?: Pptx.ShapeFillProps } =>
  css.backgroundColor === undefined || css.backgroundAlpha === 0
    ? {}
    : { fill: withTransparency({ type: 'solid' as const, color: hexOf(css.backgroundColor) }, css.backgroundAlpha, opacity) };

const lineOf = (side: BorderSide, opacity: number): Pptx.ShapeLineProps =>
  withTransparency({ color: hexOf(side.color), width: side.width, dashType: DASH_TYPES[side.style] }, side.alpha, opacity);

/**
 * M12: kind do fundo da caixa. Sem `shape` (ou rect/roundRect) vale o raio, como antes; as demais
 * kinds ignoram o raio (o fit avisa com css-not-emitted).
 */
export const boxShapeOf = (node: PositionedNode): ShapeKind => {
  const shape = node.kind === 'box' ? node.props.shape : undefined;
  return shape === undefined || shape === 'rect' || shape === 'roundRect' ? 'rect' : shape;
};

const geometryFor = (kind: ShapeKind, radius: number | undefined, rect: Rect): { readonly shape: Pptx.ShapeName; readonly rectRadius?: number } => {
  if (kind !== 'rect') return shapeGeometryOf(kind, radius, rect);
  return radius !== undefined && radius > 0 ? { shape: 'roundRect', rectRadius: rectRadiusOf(radius, rect) } : { shape: 'rect' };
};

const shapeSpec = (rect: Rect, item: PaintItem, radius: number | undefined, options: Pptx.ShapeProps): ShapeSpec => {
  const { shape, rectRadius } = geometryFor(item.node.kind === 'box' ? boxShapeOf(item.node) : 'rect', radius, rect);
  return {
    shape,
    options: { ...placedOf(rect, item.rotations), ...(rectRadius === undefined ? {} : { rectRadius }), ...options },
  };
};

/** Extremos da linha de um lado: centrada na faixa da borda, dentro do border-box. */
export const sideSegmentOf = (frame: Rect, side: Side, width: number): Rect => {
  const half = width / 2;
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const segments: Readonly<Record<Side, Rect>> = {
    top: { x: frame.x, y: frame.y + half, width: frame.width, height: 0 },
    bottom: { x: frame.x, y: bottom - half, width: frame.width, height: 0 },
    left: { x: frame.x + half, y: frame.y, width: 0, height: frame.height },
    right: { x: right - half, y: frame.y, width: 0, height: frame.height },
  };
  return segments[side];
};

/** Uma linha por lado com borda. */
const sideLineOf = (frame: Rect, side: Side, border: BorderSide, item: PaintItem): ShapeSpec => ({
  shape: 'line',
  options: { ...placedOf(sideSegmentOf(frame, side, border.width), item.rotations), line: lineOf(border, item.opacity) },
});

const shadowOptions = (css: CssStyle, opacity: number): { readonly shadow?: Pptx.ShadowProps } =>
  css.boxShadow === undefined ? {} : { shadow: shadowOf(css.boxShadow, opacity) };

/** Fundo e/ou sombra sem linha (antes das bordas por lado ou da imagem de fundo). */
const backgroundSpec = (node: PositionedNode, item: PaintItem): readonly ShapeSpec[] => {
  const { css } = node;
  const fill = fillOf(css, item.opacity);
  if (fill.fill === undefined && css.boxShadow === undefined) return [];
  return [shapeSpec(node.frame, item, css.borderRadius, { ...fill, ...shadowOptions(css, item.opacity) })];
};

/** Contorno (`outline`, açúcar antigo `stroke`): linha centrada no frame, sem ocupar espaço (como a engine). */
const outlineSpec = (node: PositionedNode, item: PaintItem, withFill: boolean): ShapeSpec | undefined => {
  const { outline } = node.css;
  if (outline === undefined) return undefined;
  const fill = withFill ? fillOf(node.css, item.opacity) : {};
  const line = withTransparency({ color: hexOf(outline.color), width: outline.width }, 1, item.opacity);
  const shadow = withFill ? shadowOptions(node.css, item.opacity) : {};
  return shapeSpec(node.frame, item, node.css.borderRadius, { ...fill, line, ...shadow });
};

export interface Decoration {
  /** Formas antes do conteúdo e da imagem de fundo (fundo, sombra). */
  readonly under: readonly ShapeSpec[];
  /** Formas depois da imagem de fundo (bordas, contorno). */
  readonly over: readonly ShapeSpec[];
}

const EMPTY: Decoration = { under: [], over: [] };

/**
 * Fundo + borda uniforme = uma forma (fill + linha recuada). Bordas diferentes por lado = fundo
 * sem linha + uma linha por lado. Com imagem de fundo, as bordas vão por cima dela. Só contorno
 * (o `fill`/`stroke` antigos) = uma forma, como a engine emitia.
 */
export const decorationOf = (node: PositionedNode, item: PaintItem): Decoration => {
  const { css } = node;
  const uniform = uniformBorderOf(css);
  const hasImage = hasBackgroundImage(node);
  const outlineOnly = uniform === undefined && !hasImage ? outlineSpec(node, item, true) : undefined;
  if (outlineOnly !== undefined) return { under: [outlineOnly], over: [] };
  const outline = outlineSpec(node, item, false);
  const extra = outline === undefined ? [] : [outline];
  if (uniform !== undefined && !hasImage) {
    const options = { ...fillOf(css, item.opacity), line: lineOf(uniform, item.opacity), ...shadowOptions(css, item.opacity) };
    const border = shapeSpec(insetRect(node.frame, uniform.width / 2), item, insetRadiusOf(css.borderRadius, uniform), options);
    return { under: [border, ...extra], over: [] };
  }
  const background = backgroundSpec(node, item);
  const sides =
    uniform !== undefined
      ? [shapeSpec(insetRect(node.frame, uniform.width / 2), item, css.borderRadius, { line: lineOf(uniform, item.opacity) })]
      : boxShapeOf(node) !== 'rect'
        ? []
        : visibleSidesOf(css).map((side) => sideLineOf(node.frame, side, css.border[side], item));
  if (background.length === 0 && sides.length === 0 && extra.length === 0) return EMPTY;
  return { under: background, over: [...sides, ...extra] };
};

/** Imagem de fundo da caixa (cover), entre o fundo e as bordas. */
export const backgroundImageOf = (node: PositionedNode, item: PaintItem, baseDir: string): Pptx.ImageProps | undefined => {
  const src = node.css.backgroundImage;
  if (src === undefined || !hasBackgroundImage(node)) return undefined;
  const box = positionOf(node.frame);
  return {
    path: resolveAssetPath(baseDir, src),
    ...placedOf(node.frame, item.rotations),
    sizing: { type: 'cover', w: box.w, h: box.h },
    altText: basename(src),
  };
};

// ───────────── pintura sobre o conteúdo ─────────────

const transparencyOption = (opacity: number): { readonly transparency?: number } => {
  const transparency = transparencyOf(1, opacity);
  return transparency === 0 ? {} : { transparency };
};

/** `letterSpacing` → `charSpacing` e opacidade herdada em cada run (o PPTX não tem opacidade de caixa de texto). */
export const paintedRunsOf = (runs: readonly Pptx.TextProps[], css: CssStyle, opacity: number): Pptx.TextProps[] => {
  const spacing = css.letterSpacing === 0 ? {} : { charSpacing: css.letterSpacing };
  const transparency = transparencyOption(opacity);
  return runs.map((run) => ({ ...run, options: { ...run.options, ...spacing, ...transparency } }));
};

/** Imagem de conteúdo girada e translúcida (a posição continua a do `imageOf`, pelo `sizing`). */
export const paintedImageOf = (image: Pptx.ImageProps, content: Rect, item: PaintItem): Pptx.ImageProps => {
  const { rotate } = placedOf(content, item.rotations);
  return { ...image, ...(rotate === undefined ? {} : { rotate }), ...transparencyOption(item.opacity) };
};

const withOpacity = <T extends object>(props: T | undefined, opacity: number): T | undefined =>
  props === undefined ? undefined : { ...props, ...transparencyOption(opacity) };

/** Shape: geometria da engine (options.ts) com posição girada, opacidade, sombra e a marca de cap/join. */
export const paintedShapeOf = (spec: ShapeSpec, node: PositionedNode, item: PaintItem, ends: LineEnds = {}): ShapeSpec => {
  const fill = withOpacity(spec.options.fill, item.opacity);
  const line = withOpacity(spec.options.line, item.opacity);
  return {
    shape: spec.shape,
    options: {
      ...spec.options,
      ...placedOf(node.frame, item.rotations),
      ...(fill ? { fill } : {}),
      ...(line ? { line } : {}),
      ...shadowOptions(node.css, item.opacity),
      ...lineMarkerOf(ends, item.index),
    },
  };
};
