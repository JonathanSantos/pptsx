import type { PathCommand, PathProps, Rect } from '../core/types.ts';
import { ResolveError } from './errors.ts';
import { boundsOf, parsePathData } from './path-data.ts';
import { assertOneOf, LINE_CAPS, LINE_STYLES } from './shape.ts';

/** Path (M12-3): `d` normalizado e viewBox efetivo. `d` fora do subconjunto não derruba o build: vira `problem`. */

type PathResolvedProps = Omit<PathProps, 'children'>;

const LINE_JOINS = ['miter', 'round', 'bevel'] as const;

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

const viewBoxOf = (props: PathResolvedProps, fallback: Rect, path: string): Rect => {
  if (props.viewBox === undefined) return fallback;
  const [width, height] = Array.isArray(props.viewBox) ? props.viewBox : [];
  if (props.viewBox.length !== 2 || !isPositive(width) || !isPositive(height)) {
    throw new ResolveError(`<Path>: viewBox ${JSON.stringify(props.viewBox)} inválido; use [largura, altura] positivos`, path);
  }
  return { x: 0, y: 0, width, height };
};

export interface PathGeometry {
  readonly commands: readonly PathCommand[];
  readonly viewBox: Rect;
  readonly problem?: string;
}

export const pathGeometryOf = (props: PathResolvedProps, path: string): PathGeometry => {
  if (typeof props.d !== 'string') throw new ResolveError('<Path> precisa de d (dados de caminho do SVG)', path);
  assertOneOf(props.lineCap, LINE_CAPS, '<Path>: lineCap', path);
  assertOneOf(props.lineJoin, LINE_JOINS, '<Path>: lineJoin', path);
  assertOneOf(props.lineStyle, LINE_STYLES, '<Path>: lineStyle', path);
  const parsed = parsePathData(props.d);
  if ('problem' in parsed) return { commands: [], viewBox: viewBoxOf(props, { x: 0, y: 0, width: 0, height: 0 }, path), problem: parsed.problem };
  return { commands: parsed.commands, viewBox: viewBoxOf(props, boundsOf(parsed.commands), path) };
};
