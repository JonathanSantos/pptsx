import { describe, expect, it } from 'vitest';
import type { PathCommand } from '../../src/core/types.ts';
import { arcToCubics, boundsOf, parsePathData } from '../../src/resolve/path-data.ts';

const commandsOf = (d: string): readonly PathCommand[] => {
  const parsed = parsePathData(d);
  if ('problem' in parsed) throw new Error(parsed.problem);
  return parsed.commands;
};

describe('M12-3 — parser do d', () => {
  it('M e L absolutos; pares extras de M viram L', () => {
    expect(commandsOf('M0 0 L10 5 20 0')).toEqual([
      { op: 'M', x: 0, y: 0 },
      { op: 'L', x: 10, y: 5 },
      { op: 'L', x: 20, y: 0 },
    ]);
    expect(commandsOf('M0 0 10 10')[1]).toEqual({ op: 'L', x: 10, y: 10 });
  });

  it('relativos, H, V e Z (volta ao início do subcaminho)', () => {
    expect(commandsOf('m10 10 h5 v5 l-5 0 z m20 0 l1 1')).toEqual([
      { op: 'M', x: 10, y: 10 },
      { op: 'L', x: 15, y: 10 },
      { op: 'L', x: 15, y: 15 },
      { op: 'L', x: 10, y: 15 },
      { op: 'Z' },
      { op: 'M', x: 30, y: 10 },
      { op: 'L', x: 31, y: 11 },
    ]);
  });

  it('C e S (reflete o 2º controle)', () => {
    expect(commandsOf('M0 0 C0 10 10 10 10 0 S20 -10 20 0')).toEqual([
      { op: 'M', x: 0, y: 0 },
      { op: 'C', x1: 0, y1: 10, x2: 10, y2: 10, x: 10, y: 0 },
      { op: 'C', x1: 10, y1: -10, x2: 20, y2: -10, x: 20, y: 0 },
    ]);
  });

  it('Q e T (reflete o controle; T sem Q antes usa o ponto atual)', () => {
    expect(commandsOf('M0 0 Q5 10 10 0 T20 0')).toEqual([
      { op: 'M', x: 0, y: 0 },
      { op: 'Q', x1: 5, y1: 10, x: 10, y: 0 },
      { op: 'Q', x1: 15, y1: -10, x: 20, y: 0 },
    ]);
    expect(commandsOf('M0 0 t10 0')[1]).toEqual({ op: 'Q', x1: 0, y1: 0, x: 10, y: 0 });
  });

  it('números colados e flags de arco sem espaço', () => {
    expect(commandsOf('M.5.5-1-1')).toEqual([{ op: 'M', x: 0.5, y: 0.5 }, { op: 'L', x: -1, y: -1 }]);
    expect(commandsOf('M0 0a5 5 0 0110 0').at(-1)).toMatchObject({ op: 'C', x: 10, y: 0 });
    expect(commandsOf('M0 0 L1e1 2E-1')[1]).toEqual({ op: 'L', x: 10, y: 0.2 });
  });

  it('fora do subconjunto ou malformado → problem', () => {
    expect(parsePathData('M0 0 X5')).toEqual({ problem: expect.stringMatching(/comando "X"/) });
    expect(parsePathData('10 10')).toEqual({ problem: expect.stringMatching(/sem comando/) });
    expect(parsePathData('M0 0 L5')).toEqual({ problem: expect.stringMatching(/pede 2/) });
    expect(parsePathData('L5 5')).toEqual({ problem: expect.stringMatching(/começar com M/) });
    expect(parsePathData('')).toEqual({ problem: expect.stringMatching(/vazio/) });
  });
});

/** Distância máxima (relativa ao raio) de pontos das cúbicas até o círculo de centro c e raio r. */
const maxRadialError = (from: readonly [number, number], cubics: readonly PathCommand[], cx: number, cy: number, r: number): number => {
  let start = from;
  let worst = 0;
  for (const c of cubics) {
    if (c.op !== 'C') throw new Error('cúbica esperada');
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const u = 1 - t;
      const x = u ** 3 * start[0] + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t ** 3 * c.x;
      const y = u ** 3 * start[1] + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t ** 3 * c.y;
      worst = Math.max(worst, Math.abs(Math.hypot(x - cx, y - cy) - r) / r);
    }
    start = [c.x, c.y];
  }
  return worst;
};

describe('M12-3 — arcos em cúbicas', () => {
  it('meia-volta: 2 cúbicas, erro ≤ 0,1 % do raio', () => {
    const cubics = arcToCubics([0, 0], [10, 10], 0, false, true, [20, 0]);
    expect(cubics).toHaveLength(2);
    expect(maxRadialError([0, 0], cubics, 10, 0, 10)).toBeLessThan(0.001);
  });

  it('arco grande quase completo: no máximo 4 cúbicas', () => {
    const cubics = arcToCubics([10, 0], [10, 10], 0, true, true, [10 - 0.01, 0]);
    expect(cubics.length).toBeLessThanOrEqual(4);
    expect(maxRadialError([10, 0], cubics, 10, 10, 10)).toBeLessThan(0.001);
  });

  it('raio pequeno demais cresce até ligar os pontos; raio 0 vira reta', () => {
    const cubics = arcToCubics([0, 0], [1, 1], 0, false, true, [20, 0]);
    expect(maxRadialError([0, 0], cubics, 10, 0, 10)).toBeLessThan(0.001);
    expect(arcToCubics([0, 0], [0, 5], 0, false, true, [20, 0])).toEqual([{ op: 'L', x: 20, y: 0 }]);
  });

  it('sweep escolhe o lado: 1 passa por cima (y negativo) indo da esquerda para a direita', () => {
    const [first] = arcToCubics([0, 0], [10, 10], 0, false, true, [20, 0]);
    expect(first).toMatchObject({ y: -10 });
    const [other] = arcToCubics([0, 0], [10, 10], 0, false, false, [20, 0]);
    expect(other).toMatchObject({ y: 10 });
  });
});

describe('M12-3 — caixa envolvente exata', () => {
  it('curva pelos extremos, não pelos controles', () => {
    const box = boundsOf(commandsOf('M0 0 C0 20 20 20 20 0'));
    expect(box.x).toBe(0);
    expect(box.width).toBe(20);
    expect(box.height).toBeCloseTo(15, 6);
  });

  it('quadrática', () => {
    expect(boundsOf(commandsOf('M0 0 Q10 20 20 0')).height).toBeCloseTo(10, 6);
  });
});
