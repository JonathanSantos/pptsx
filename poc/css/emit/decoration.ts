import type * as Pptx from '../../../src/emit/pptx.ts';
import type * as PptxTypes from 'pptxgenjs';

type ShadowProps = PptxTypes.default.ShadowProps;
import { hexOf, positionOf, rectRadiusOf, type ShapeSpec } from '../../../src/emit/options.ts';
import type { Rect } from '../../../src/core/types.ts';
import { POC_DEFAULTS } from '../defaults.ts';
import { placementOf, type PaintItem, type Rotation } from '../paint.ts';
import type { BorderSide, BorderStyle, CssStyle, PositionedNode, Shadow, Side } from '../types.ts';

/**
 * Pintura da caixa CSS (fundo, bordas, contorno antigo, sombra) → formas do pptxgenjs. Puro.
 * O shape do PPTX desenha a linha centrada na borda; a borda CSS fica dentro do border-box,
 * então a forma de uma borda uniforme é o frame recuado em largura/2 (H6, §6 da spec).
 */

const DASH_TYPES: Readonly<Record<BorderStyle, Pptx.ShapeLineProps['dashType']>> = {
  solid: 'solid',
  dashed: 'dash',
  dotted: 'sysDot',
  none: 'solid',
};

/** 0..100 do PPTX a partir de alpha × opacidade herdada. */
export const transparencyOf = (alpha: number, opacity: number): number =>
  Math.round((1 - alpha * opacity) * POC_DEFAULTS.transparencyScale);

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

const inset = (frame: Rect, amount: number): Rect => ({
  x: frame.x + amount,
  y: frame.y + amount,
  width: Math.max(0, frame.width - 2 * amount),
  height: Math.max(0, frame.height - 2 * amount),
});

export const shadowOf = (shadow: Shadow, opacity: number): ShadowProps => {
  const degrees = (Math.atan2(shadow.y, shadow.x) * 180) / Math.PI;
  return {
    type: 'outer',
    blur: shadow.blur,
    offset: Math.hypot(shadow.x, shadow.y),
    angle: Math.round(((degrees % 360) + 360) % 360),
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

const geometryOf = (radius: number | undefined, rect: Rect): { readonly shape: Pptx.ShapeName; readonly rectRadius?: number } =>
  radius !== undefined && radius > 0 ? { shape: 'roundRect', rectRadius: rectRadiusOf(radius, rect) } : { shape: 'rect' };

const shapeSpec = (rect: Rect, item: PaintItem, radius: number | undefined, options: Pptx.ShapeProps): ShapeSpec => {
  const { shape, rectRadius } = geometryOf(radius, rect);
  return {
    shape,
    options: { ...placedOf(rect, item.rotations), ...(rectRadius === undefined ? {} : { rectRadius }), ...options },
  };
};

/** Uma linha por lado com borda: centrada na faixa da borda, dentro do border-box. */
const sideLineOf = (frame: Rect, side: Side, border: BorderSide, item: PaintItem): ShapeSpec => {
  const half = border.width / 2;
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const rects: Readonly<Record<Side, Rect>> = {
    top: { x: frame.x, y: frame.y + half, width: frame.width, height: 0 },
    bottom: { x: frame.x, y: bottom - half, width: frame.width, height: 0 },
    left: { x: frame.x + half, y: frame.y, width: 0, height: frame.height },
    right: { x: right - half, y: frame.y, width: 0, height: frame.height },
  };
  return { shape: 'line', options: { ...placedOf(rects[side], item.rotations), line: lineOf(border, item.opacity) } };
};

const shadowOptions = (css: CssStyle, opacity: number): { readonly shadow?: ShadowProps } =>
  css.boxShadow === undefined ? {} : { shadow: shadowOf(css.boxShadow, opacity) };

/** Fundo e/ou sombra sem linha (antes das bordas por lado ou da imagem de fundo). */
const backgroundSpec = (node: PositionedNode, item: PaintItem): readonly ShapeSpec[] => {
  const { css } = node;
  const fill = fillOf(css, item.opacity);
  if (fill.fill === undefined && css.boxShadow === undefined) return [];
  return [shapeSpec(node.frame, item, css.borderRadius, { ...fill, ...shadowOptions(css, item.opacity) })];
};

/** Contorno do açúcar antigo `stroke`: linha centrada no frame, sem ocupar espaço (como a engine). */
const outlineSpec = (node: PositionedNode, item: PaintItem, withFill: boolean): ShapeSpec | undefined => {
  const { outline } = node.css;
  if (outline === undefined) return undefined;
  const fill = withFill ? fillOf(node.css, item.opacity) : {};
  const line = withTransparency({ color: hexOf(outline.color), width: outline.width }, 1, item.opacity);
  return shapeSpec(node.frame, item, node.css.borderRadius, { ...fill, line, ...(withFill ? shadowOptions(node.css, item.opacity) : {}) });
};

export interface Decoration {
  /** Formas antes do conteúdo e da imagem de fundo (fundo, sombra). */
  readonly under: readonly ShapeSpec[];
  /** Formas depois da imagem de fundo (bordas). */
  readonly over: readonly ShapeSpec[];
}

const EMPTY: Decoration = { under: [], over: [] };

/**
 * Fundo + borda uniforme = uma forma (fill + linha recuada). Bordas diferentes por lado = fundo
 * sem linha + uma linha por lado. Com imagem de fundo, as bordas vão por cima dela.
 */
export const decorationOf = (node: PositionedNode, item: PaintItem): Decoration => {
  const { css } = node;
  const uniform = uniformBorderOf(css);
  const hasImage = css.backgroundImage !== undefined && node.kind !== 'image';
  const outlineOnly = uniform === undefined && !hasImage ? outlineSpec(node, item, true) : undefined;
  if (outlineOnly !== undefined) return { under: [outlineOnly], over: [] };
  const outline = outlineSpec(node, item, false);
  const extra = outline === undefined ? [] : [outline];
  if (uniform !== undefined && !hasImage) {
    const radius = css.borderRadius === undefined ? undefined : Math.max(0, css.borderRadius - uniform.width / 2);
    const options = { ...fillOf(css, item.opacity), line: lineOf(uniform, item.opacity), ...shadowOptions(css, item.opacity) };
    return { under: [shapeSpec(inset(node.frame, uniform.width / 2), item, radius, options), ...extra], over: [] };
  }
  const background = backgroundSpec(node, item);
  const sides = uniform !== undefined
    ? [shapeSpec(inset(node.frame, uniform.width / 2), item, css.borderRadius, { line: lineOf(uniform, item.opacity) })]
    : SIDES.filter((side) => isVisible(css.border[side])).map((side) => sideLineOf(node.frame, side, css.border[side], item));
  if (background.length === 0 && sides.length === 0 && extra.length === 0) return EMPTY;
  return { under: background, over: [...sides, ...extra] };
};
