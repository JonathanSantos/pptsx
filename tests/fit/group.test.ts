import { describe, expect, it } from 'vitest';
import { groupDiagnostics } from '../../src/fit/index.ts';
import type { Diagnostic } from '../../src/core/types.ts';
import { fileURLToPath } from 'node:url';
import { render } from '../../src/render.ts';
import brokenOriginal from '../../examples/agent-test/broken-original.tsx';

const AGENT_TEST_DIR = fileURLToPath(new URL('../../examples/agent-test/', import.meta.url));

/** CONTRACTS §fit "Agrupamento (M6)": função pura sobre diagnósticos montados à mão. */

const diag = (path: string, over: Partial<Diagnostic> = {}): Diagnostic => ({
  severity: 'error',
  code: 'text-overflow',
  size: '16x9',
  slide: 1,
  path,
  message: `estourou em ${path}`,
  data: { overflowPt: 10, overflowPct: 20 },
  ...over,
});

const card = (i: number, over: Partial<Diagnostic> = {}) => diag(`Slide > Box > Box[${i}] > Text`, over);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('groupDiagnostics — siblings with the same problem', () => {
  it('8 siblings → 1 diagnostic with Box[0..7], count 8 and the 8 paths in order', () => {
    const input = range(8).map((i) => card(i));
    const out = groupDiagnostics(input);
    expect(out).toHaveLength(1);
    const [g] = out;
    expect(g!.path).toBe('Slide > Box > Box[0..7] > Text');
    expect(g!.data?.count).toBe(8);
    expect(g!.data?.paths).toEqual(input.map((d) => d.path));
    expect(g!.severity).toBe('error');
    expect(g!.code).toBe('text-overflow');
    expect(g!.size).toBe('16x9');
    expect(g!.slide).toBe(1);
  });

  it('message = worst message + " (×N: mesmo problema em Segmento[a..b])"', () => {
    const [g] = groupDiagnostics(range(8).map((i) => card(i)));
    expect(g!.message).toBe('estourou em Slide > Box > Box[0] > Text (×8: mesmo problema em Box[0..7])');
  });

  it('two siblings are enough: Text[0..1]', () => {
    const [g, ...rest] = groupDiagnostics([diag('Slide > Bullets > Text[0]'), diag('Slide > Bullets > Text[1]')]);
    expect(rest).toEqual([]);
    expect(g!.path).toBe('Slide > Bullets > Text[0..1]');
    expect(g!.data?.count).toBe(2);
    expect(g!.message).toMatch(/ \(×2: mesmo problema em Text\[0\.\.1\]\)$/);
  });

  it('non-contiguous indices → Box[0,2,5]', () => {
    const [g, ...rest] = groupDiagnostics([card(0), card(2), card(5)]);
    expect(rest).toEqual([]);
    expect(g!.path).toBe('Slide > Box > Box[0,2,5] > Text');
    expect(g!.data?.count).toBe(3);
    expect(g!.data?.paths).toEqual([card(0).path, card(2).path, card(5).path]);
    expect(g!.message).toMatch(/ \(×3: mesmo problema em Box\[0,2,5\]\)$/);
  });

  it('paths come out in increasing index order even when the input is shuffled', () => {
    const [g] = groupDiagnostics([card(2), card(0), card(1)]);
    expect(g!.path).toBe('Slide > Box > Box[0..2] > Text');
    expect(g!.data?.paths).toEqual([card(0).path, card(1).path, card(2).path]);
  });
});

describe('groupDiagnostics — the worst member dictates message and data', () => {
  it('largest overflowPt wins: its message and numeric data (same fromSize/toSize for all)', () => {
    const input = [
      card(0, { message: 'leve', data: { overflowPt: 5, overflowPct: 10, fromSize: 24, toSize: 18 } }),
      card(1, { message: 'pior', data: { overflowPt: 30, overflowPct: 60, fromSize: 24, toSize: 18 } }),
      card(2, { message: 'médio', data: { overflowPt: 12, overflowPct: 25, fromSize: 24, toSize: 18 } }),
    ];
    const out = groupDiagnostics(input);
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toBe('pior (×3: mesmo problema em Box[0..2])');
    expect(out[0]!.data).toMatchObject({ overflowPt: 30, overflowPct: 60, fromSize: 24, toSize: 18, count: 3 });
  });

  it('tie on overflowPt → lowest index', () => {
    const input = [
      card(1, { message: 'um', data: { overflowPt: 30, overflowPct: 60 } }),
      card(0, { message: 'zero', data: { overflowPt: 30, overflowPct: 50 } }),
    ];
    const [g] = groupDiagnostics(input);
    expect(g!.message.startsWith('zero (×2')).toBe(true);
    expect(g!.data?.overflowPct).toBe(50);
  });

  it('without overflowPt and with equal toSize → lowest index', () => {
    const shrunk = (i: number, message: string) =>
      card(i, { severity: 'info', code: 'text-shrunk', message, data: { fromSize: 24, toSize: 18 } });
    const [g, ...rest] = groupDiagnostics([shrunk(2, 'dois'), shrunk(0, 'zero'), shrunk(1, 'um')]);
    expect(rest).toEqual([]);
    expect(g!.message).toBe('zero (×3: mesmo problema em Box[0..2])');
    expect(g!.data).toMatchObject({ fromSize: 24, toSize: 18, count: 3 });
  });

  it('shared causedBy is kept on the group', () => {
    const causedBy = 'Slide > Text[1]';
    const [g] = groupDiagnostics(range(3).map((i) => card(i, { data: { overflowPt: 10, causedBy } })));
    expect(g!.data?.causedBy).toBe(causedBy);
  });
});

describe('groupDiagnostics — what still groups', () => {
  it('text-overflow with different overflowPt but the same fromSize/toSize', () => {
    const input = [
      card(0, { data: { overflowPt: 4, overflowPct: 8, fromSize: 24, toSize: 18 } }),
      card(1, { data: { overflowPt: 9, overflowPct: 18, fromSize: 24, toSize: 18 } }),
    ];
    const out = groupDiagnostics(input);
    expect(out).toHaveLength(1);
    expect(out[0]!.data).toMatchObject({ count: 2, overflowPt: 9, fromSize: 24, toSize: 18 });
  });
});

describe('groupDiagnostics — what does not group', () => {
  it('index differs in two different segments', () => {
    const input = [diag('Slide > Box[0] > Text[0]'), diag('Slide > Box[1] > Text[1]')];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it('different toSize splits the group: two 44→28 and one 44→41 → KpiCard[0..1] + a single KpiCard[2]', () => {
    const kpi = (i: number, toSize: number) =>
      diag(`Slide > KpiRow > KpiCard[${i}] > Text[1]`, {
        severity: 'info',
        code: 'text-shrunk',
        message: `reduzido de 44 pt para ${toSize} pt`,
        data: { fromSize: 44, toSize },
      });
    const single = kpi(2, 41);
    const out = groupDiagnostics([kpi(0, 28), kpi(1, 28), single]);
    expect(out).toHaveLength(2);
    // Índices contíguos usam a forma [a..b] (CONTRACTS §fit "Agrupamento").
    expect(out[0]!.path).toBe('Slide > KpiRow > KpiCard[0..1] > Text[1]');
    expect(out[0]!.data).toMatchObject({ count: 2, fromSize: 44, toSize: 28 });
    expect(out[0]!.data?.paths).toEqual(['Slide > KpiRow > KpiCard[0] > Text[1]', 'Slide > KpiRow > KpiCard[1] > Text[1]']);
    expect(out[1]).toEqual(single);
  });

  it('different fromSize splits the group', () => {
    const input = [
      card(0, { severity: 'info', code: 'text-shrunk', data: { fromSize: 24, toSize: 18 } }),
      card(1, { severity: 'info', code: 'text-shrunk', data: { fromSize: 22, toSize: 18 } }),
    ];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it('fromSize/toSize on one and not on the other', () => {
    const input = [card(0, { data: { overflowPt: 10, fromSize: 24, toSize: 18 } }), card(1)];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it('different causedBy', () => {
    const input = [
      card(0, { data: { overflowPt: 10, causedBy: 'Slide > Text[1]' } }),
      card(1, { data: { overflowPt: 10, causedBy: 'Slide > Text[2]' } }),
    ];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it('causedBy on one and not on the other', () => {
    const input = [card(0, { data: { overflowPt: 10, causedBy: 'Slide > Text[1]' } }), card(1)];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it.each([
    ['code', { code: 'box-overflow' }],
    ['severity', { severity: 'warning' }],
    ['size', { size: '4x3' }],
    ['slide', { slide: 2 }],
  ] as const)('different %s', (_, over) => {
    const input = [card(0), card(1, over)];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it('different segment names (Box[0] vs Card[1])', () => {
    const input = [diag('Slide > Box[0] > Text'), diag('Slide > Card[1] > Text')];
    expect(groupDiagnostics(input)).toEqual(input);
  });

  it('a unique diagnostic gets neither count nor paths and comes out unchanged', () => {
    const single = card(3);
    const out = groupDiagnostics([single, diag('Slide > Text', { code: 'font-missing', data: undefined })]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(single);
    expect(out[0]!.data?.count).toBeUndefined();
    expect(out[0]!.data?.paths).toBeUndefined();
    expect(out[1]!.data?.count).toBeUndefined();
  });

  it('empty list → empty list', () => {
    expect(groupDiagnostics([])).toEqual([]);
  });
});

describe('groupDiagnostics — nested lists group per parent', () => {
  it('Box[i] > Text[j]: one group per Box, over Text[j]', () => {
    const input = [
      diag('Slide > Box[0] > Text[0]'),
      diag('Slide > Box[0] > Text[1]'),
      diag('Slide > Box[1] > Text[0]'),
      diag('Slide > Box[1] > Text[1]'),
    ];
    const out = groupDiagnostics(input);
    expect(out.map((d) => d.path)).toEqual(['Slide > Box[0] > Text[0..1]', 'Slide > Box[1] > Text[0..1]']);
    expect(out.map((d) => d.data?.count)).toEqual([2, 2]);
    expect(out[0]!.data?.paths).toEqual(['Slide > Box[0] > Text[0]', 'Slide > Box[0] > Text[1]']);
  });
});

describe('groupDiagnostics — order and purity', () => {
  it('the group takes the position of its first member', () => {
    const before = diag('Slide > Header', { code: 'font-missing', data: undefined });
    const after = diag('Slide > Footer', { severity: 'warning', code: 'text-truncated', data: undefined });
    const other = diag('Slide > Text', { severity: 'info', code: 'text-shrunk', data: { fromSize: 20, toSize: 18 } });
    const out = groupDiagnostics([before, card(0), other, card(1), after, card(2)]);
    expect(out.map((d) => d.path)).toEqual(['Slide > Header', 'Slide > Box > Box[0..2] > Text', 'Slide > Text', 'Slide > Footer']);
  });

  it('does not mutate the input', () => {
    const input = range(4).map((i) => card(i));
    const snapshot = structuredClone(input);
    groupDiagnostics(input);
    expect(input).toEqual(snapshot);
  });

  it('works on frozen input', () => {
    const input = Object.freeze(range(3).map((i) => Object.freeze(card(i, { data: Object.freeze({ overflowPt: 10 }) }))));
    expect(() => groupDiagnostics(input)).not.toThrow();
  });
});

describe('groupDiagnostics — integration: broken-original.tsx slide 2 (16x9)', () => {
  // O valor curto de KpiCard[3] ("182 ms") encolhe menos que os irmãos: não pode sumir no grupo.
  it('KpiCard[3] > Text[1] is a separate text-shrunk with a larger toSize than the group', async () => {
    const [result] = await render(brokenOriginal, { sizes: ['16x9'], preview: false, baseDir: AGENT_TEST_DIR });
    const shrunk = result!.diagnostics.filter((d) => d.slide === 2 && d.code === 'text-shrunk' && /KpiCard.* > Text\[1\]$/.test(d.path));
    const single = shrunk.find((d) => /KpiCard\[3\] > Text\[1\]$/.test(d.path));
    const group = shrunk.find((d) => (d.data?.count ?? 0) > 1);
    expect(single, JSON.stringify(shrunk, null, 2)).toBeDefined();
    expect(group).toBeDefined();
    expect(single!.data?.count).toBeUndefined();
    expect(group!.path).toMatch(/KpiCard\[0,1,2,4\] > Text\[1\]$/);
    expect(group!.data?.paths?.some((p) => p.includes('KpiCard[3]'))).toBe(false);
    expect(single!.data!.toSize!).toBeGreaterThan(group!.data!.toSize!);
    expect(single!.data?.fromSize).toBe(group!.data?.fromSize);
  }, 60_000);
});
