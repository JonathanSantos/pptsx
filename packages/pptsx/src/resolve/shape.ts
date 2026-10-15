import { DEFAULTS } from '../core/defaults.ts';
import type { ArrowType, BoxProps, LineCap, LineStyle, ShapeKind, ShapeProps } from '../core/types.ts';
import { ResolveError } from './errors.ts';

/** Validação das props de forma (M12-2): kinds curadas, setas só em linha, Box shape sem `line`. */

export const SHAPE_KINDS: readonly ShapeKind[] = Object.keys(DEFAULTS.shape.pptx) as ShapeKind[];
export const ARROW_TYPES: readonly ArrowType[] = ['none', 'arrow', 'triangle', 'stealth', 'diamond', 'oval'];
export const LINE_STYLES: readonly LineStyle[] = ['solid', 'dashed', 'dotted'];
export const LINE_CAPS: readonly LineCap[] = ['flat', 'round'];

const quoted = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');

/** Valor fora da lista → ResolveError com a lista válida. */
export const assertOneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  what: string,
  path: string,
): void => {
  if (value === undefined || (allowed as readonly unknown[]).includes(value)) return;
  throw new ResolveError(`${what} ${JSON.stringify(value)} inválido; use ${quoted(allowed)}`, path);
};

const hasArrow = (arrow: ArrowType | undefined): boolean => arrow !== undefined && arrow !== 'none';

const assertArrowsOnLine = (props: Omit<ShapeProps, 'children'>, path: string): void => {
  if (props.kind === 'line' || (!hasArrow(props.startArrow) && !hasArrow(props.endArrow))) return;
  throw new ResolveError(`<Shape kind="${props.kind}">: startArrow/endArrow só valem em kind="line"; para seta cheia use kind="arrowRight" ou <Connector>`, path);
};

export const assertValidShape = (props: Omit<ShapeProps, 'children'>, path: string): void => {
  if (props.kind === undefined) throw new ResolveError(`<Shape> precisa de kind; use ${quoted(SHAPE_KINDS)}`, path);
  assertOneOf(props.kind, SHAPE_KINDS, '<Shape>: kind', path);
  assertOneOf(props.lineStyle, LINE_STYLES, '<Shape>: lineStyle', path);
  assertOneOf(props.lineCap, LINE_CAPS, '<Shape>: lineCap', path);
  assertOneOf(props.startArrow, ARROW_TYPES, '<Shape>: startArrow', path);
  assertOneOf(props.endArrow, ARROW_TYPES, '<Shape>: endArrow', path);
  assertArrowsOnLine(props, path);
};

const BOX_SHAPES: readonly ShapeKind[] = SHAPE_KINDS.filter((kind) => kind !== 'line');

export const assertBoxShape = (props: Omit<BoxProps, 'children'>, path: string): void => {
  if (props.shape === 'line') throw new ResolveError('<Box shape="line"> não existe: uma caixa precisa de área; use <Shape kind="line"> ou uma borda', path);
  assertOneOf(props.shape, BOX_SHAPES, '<Box>: shape', path);
};
