import type { PathCommand, Rect } from '../core/types.ts';

/**
 * `d` do SVG → comandos normalizados (M12-3): absolutos, só M/L/C/Q/Z. H/V viram L, S/T refletem o
 * controle anterior, A vira até 4 cúbicas (uma por quarto de volta). Puro. Erro de sintaxe ou
 * comando fora do subconjunto → `{ problem }` (o fit emite path-invalid).
 */

export type ParsedPath = { readonly commands: readonly PathCommand[] } | { readonly problem: string };

const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const FLAG = /^[01]/;
const SEPARATOR = /^[\s,]*/;

/** Leitor do `d`: posição atual; cada leitura devolve o valor e a nova posição (sem estado global). */
interface Read<T> {
  readonly value: T;
  readonly rest: string;
}

const skip = (text: string): string => text.slice(SEPARATOR.exec(text)![0].length);

const readWith = (pattern: RegExp, text: string): Read<number> | undefined => {
  const rest = skip(text);
  const match = pattern.exec(rest);
  return match === null ? undefined : { value: Number(match[0]), rest: rest.slice(match[0].length) };
};

/** Flags do A (posições 3 e 4) são um dígito só: "a1 1 0 01 5 5" é válido. */
const readArgs = (letter: string, text: string): Read<readonly number[]> | undefined => {
  const arity = ARITY[letter.toUpperCase()]!;
  const isArc = letter.toUpperCase() === 'A';
  const values: number[] = [];
  let rest = text;
  for (let index = 0; index < arity; index += 1) {
    const read = readWith(isArc && (index === 3 || index === 4) ? FLAG : NUMBER, rest);
    if (read === undefined) return undefined;
    values.push(read.value);
    rest = read.rest;
  }
  return { value: values, rest };
};

const startsNumber = (text: string): boolean => NUMBER.test(skip(text));

type Group = readonly [letter: string, args: readonly number[]];

/** Grupos (comando, argumentos); repetições implícitas viram grupos próprios, e M repetido vira L (regra do SVG). */
const groupsOf = (d: string): readonly Group[] | string => {
  const groups: Group[] = [];
  let rest = skip(d);
  while (rest.length > 0) {
    const head = rest[0]!;
    if (!/[a-zA-Z]/.test(head)) return startsNumber(rest) ? `número sem comando antes em "${rest.slice(0, 12)}"` : `caractere inesperado "${head}"`;
    const arity = ARITY[head.toUpperCase()];
    if (arity === undefined) return `comando "${head}" fora do subconjunto (use M L H V C S Q T A Z)`;
    rest = rest.slice(1);
    if (arity === 0) {
      groups.push([head, []]);
      rest = skip(rest);
      continue;
    }
    let letter = head;
    do {
      const read = readArgs(letter, rest);
      if (read === undefined) return `"${head}" pede ${arity} número(s)`;
      groups.push([letter, read.value]);
      rest = read.rest;
      if (letter === 'M') letter = 'L';
      if (letter === 'm') letter = 'l';
    } while (startsNumber(rest));
    rest = skip(rest);
  }
  return groups;
};

interface Cursor {
  readonly x: number;
  readonly y: number;
  /** Início do subcaminho (Z volta para cá). */
  readonly sx: number;
  readonly sy: number;
  /** Último controle de cúbica/quadrática (para S/T). */
  readonly cubic?: readonly [number, number];
  readonly quad?: readonly [number, number];
}

const START: Cursor = { x: 0, y: 0, sx: 0, sy: 0 };

interface Step {
  readonly commands: readonly PathCommand[];
  readonly cursor: Cursor;
}

const TAU = Math.PI * 2;

/** Ângulo entre dois vetores, com sinal (SVG 1.1 F.6.5.4). */
const angleBetween = (ux: number, uy: number, vx: number, vy: number): number => {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return sign * Math.acos(Math.min(1, Math.max(-1, dot)));
};

/** Arco elíptico (parametrização por extremos) → cúbicas, uma por trecho de até 90°. */
export const arcToCubics = (
  from: readonly [number, number],
  radii: readonly [number, number],
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
  to: readonly [number, number],
): readonly PathCommand[] => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  if (x1 === x2 && y1 === y2) return [];
  let rx = Math.abs(radii[0]);
  let ry = Math.abs(radii[1]);
  if (rx === 0 || ry === 0) return [{ op: 'L', x: x2, y: y2 }];
  const phi = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  // Raios pequenos demais para ligar os pontos crescem na proporção (F.6.6).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coefficient = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coefficient * rx * y1p) / ry;
  const cyp = (-coefficient * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const theta = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angleBetween((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= TAU;
  if (sweep && delta < 0) delta += TAU;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / segments;
  // Distância dos controles para um trecho de `step` radianos no círculo unitário.
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (angle: number): readonly [number, number] => {
    const ex = rx * Math.cos(angle);
    const ey = ry * Math.sin(angle);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey];
  };
  const tangent = (angle: number): readonly [number, number] => {
    const ex = -rx * Math.sin(angle);
    const ey = ry * Math.cos(angle);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  return Array.from({ length: segments }, (_, index): PathCommand => {
    const a1 = theta + index * step;
    const a2 = a1 + step;
    const [px1, py1] = point(a1);
    const [px2, py2] = index === segments - 1 ? [x2, y2] : point(a2);
    const [tx1, ty1] = tangent(a1);
    const [tx2, ty2] = tangent(a2);
    return { op: 'C', x1: px1 + k * tx1, y1: py1 + k * ty1, x2: px2 - k * tx2, y2: py2 - k * ty2, x: px2, y: py2 };
  });
};

/** Um comando com seus argumentos (já relativos resolvidos pelo chamador). */
const stepOf = (letter: string, args: readonly number[], cursor: Cursor): Step => {
  const relative = letter === letter.toLowerCase();
  const op = letter.toUpperCase();
  const ox = relative ? cursor.x : 0;
  const oy = relative ? cursor.y : 0;
  const at = (x: number, y: number, extra: Partial<Cursor> = {}): Cursor => ({ ...cursor, x, y, cubic: undefined, quad: undefined, ...extra });
  const a = args;
  switch (op) {
    case 'M': {
      const x = a[0]! + ox;
      const y = a[1]! + oy;
      return { commands: [{ op: 'M', x, y }], cursor: at(x, y, { sx: x, sy: y }) };
    }
    case 'L': {
      const x = a[0]! + ox;
      const y = a[1]! + oy;
      return { commands: [{ op: 'L', x, y }], cursor: at(x, y) };
    }
    case 'H': {
      const x = a[0]! + ox;
      return { commands: [{ op: 'L', x, y: cursor.y }], cursor: at(x, cursor.y) };
    }
    case 'V': {
      const y = a[0]! + oy;
      return { commands: [{ op: 'L', x: cursor.x, y }], cursor: at(cursor.x, y) };
    }
    case 'C': {
      const [x1, y1, x2, y2, x, y] = [a[0]! + ox, a[1]! + oy, a[2]! + ox, a[3]! + oy, a[4]! + ox, a[5]! + oy];
      return { commands: [{ op: 'C', x1, y1, x2, y2, x, y }], cursor: at(x, y, { cubic: [x2, y2] }) };
    }
    case 'S': {
      const [x1, y1] = cursor.cubic === undefined ? [cursor.x, cursor.y] : [2 * cursor.x - cursor.cubic[0], 2 * cursor.y - cursor.cubic[1]];
      const [x2, y2, x, y] = [a[0]! + ox, a[1]! + oy, a[2]! + ox, a[3]! + oy];
      return { commands: [{ op: 'C', x1, y1, x2, y2, x, y }], cursor: at(x, y, { cubic: [x2, y2] }) };
    }
    case 'Q': {
      const [x1, y1, x, y] = [a[0]! + ox, a[1]! + oy, a[2]! + ox, a[3]! + oy];
      return { commands: [{ op: 'Q', x1, y1, x, y }], cursor: at(x, y, { quad: [x1, y1] }) };
    }
    case 'T': {
      const [x1, y1] = cursor.quad === undefined ? [cursor.x, cursor.y] : [2 * cursor.x - cursor.quad[0], 2 * cursor.y - cursor.quad[1]];
      const [x, y] = [a[0]! + ox, a[1]! + oy];
      return { commands: [{ op: 'Q', x1, y1, x, y }], cursor: at(x, y, { quad: [x1, y1] }) };
    }
    case 'A': {
      const [x, y] = [a[5]! + ox, a[6]! + oy];
      const commands = arcToCubics([cursor.x, cursor.y], [a[0]!, a[1]!], a[2]!, a[3]! !== 0, a[4]! !== 0, [x, y]);
      return { commands, cursor: at(x, y) };
    }
    default:
      return { commands: [{ op: 'Z' }], cursor: at(cursor.sx, cursor.sy) };
  }
};

export const parsePathData = (d: string): ParsedPath => {
  if (typeof d !== 'string' || d.trim() === '') return { problem: '`d` vazio' };
  const groups = groupsOf(d);
  if (typeof groups === 'string') return { problem: groups };
  if (groups[0]?.[0].toUpperCase() !== 'M') return { problem: 'o `d` tem que começar com M' };
  const { commands } = groups.reduce<Step>(
    (state, [letter, args]) => {
      const step = stepOf(letter, args, state.cursor);
      return { commands: [...state.commands, ...step.commands], cursor: step.cursor };
    },
    { commands: [], cursor: START },
  );
  return { commands };
};

// ───────────── caixa envolvente exata ─────────────

/** Raízes em (0, 1) da derivada de uma cúbica/quadrática num eixo. */
const cubicExtrema = (p0: number, p1: number, p2: number, p3: number): readonly number[] => {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)];
};

const cubicAt = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

const inside = (t: number): boolean => t > 0 && t < 1;

/** Pontos extremos de cada comando (fim, e extremos das curvas). */
const extremePoints = (commands: readonly PathCommand[]): readonly (readonly [number, number])[] => {
  const points: (readonly [number, number])[] = [];
  let x = 0;
  let y = 0;
  for (const command of commands) {
    if (command.op === 'Z') continue;
    if (command.op === 'C') {
      const ts = [...cubicExtrema(x, command.x1, command.x2, command.x), ...cubicExtrema(y, command.y1, command.y2, command.y)].filter(inside);
      ts.forEach((t) =>
        points.push([cubicAt(x, command.x1, command.x2, command.x, t), cubicAt(y, command.y1, command.y2, command.y, t)]),
      );
    }
    if (command.op === 'Q') {
      // Quadrática = cúbica com controles a 2/3.
      const c1x = x + (2 / 3) * (command.x1 - x);
      const c1y = y + (2 / 3) * (command.y1 - y);
      const c2x = command.x + (2 / 3) * (command.x1 - command.x);
      const c2y = command.y + (2 / 3) * (command.y1 - command.y);
      const ts = [...cubicExtrema(x, c1x, c2x, command.x), ...cubicExtrema(y, c1y, c2y, command.y)].filter(inside);
      ts.forEach((t) => points.push([cubicAt(x, c1x, c2x, command.x, t), cubicAt(y, c1y, c2y, command.y, t)]));
    }
    points.push([command.x, command.y]);
    x = command.x;
    y = command.y;
  }
  return points;
};

/** Caixa envolvente exata dos comandos (curvas pelos extremos, não pelos controles). */
export const boundsOf = (commands: readonly PathCommand[]): Rect => {
  const points = extremePoints(commands);
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
};
