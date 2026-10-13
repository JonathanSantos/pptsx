import { describe, expect, it } from 'vitest';
import { exitCodeOf, summaryOf } from '../../src/cli.ts';
import type { Diagnostic, Severity } from '../../src/core/types.ts';

/** CONTRACTS §cli "Resumo (M6)": derivados (data.causedBy) impressos sob a causa com ↳. */

const CAUSE = 'Slide > Text[1]';

const diag = (severity: Severity, path: string, over: Partial<Diagnostic> = {}): Diagnostic => ({
  severity,
  code: severity === 'info' ? 'text-shrunk' : severity === 'warning' ? 'text-truncated' : 'text-overflow',
  size: '16x9',
  slide: 1,
  path,
  message: `mensagem de ${path}`,
  ...over,
});

const derived = (path: string, causedBy = CAUSE): Diagnostic =>
  diag('error', path, { data: { overflowPt: 10, overflowPct: 50, causedBy }, message: `derivado ${path}` });

const cause = diag('error', CAUSE, { message: 'causa: parágrafo enorme', data: { overflowPt: 130, overflowPct: 72 } });
const title = derived('Slide > Text[0]');
const cards = derived('Slide > Box > Box[0..7] > Text');
const warning = diag('warning', 'Slide > Text[3]', { message: 'aviso solto' });

const linesOf = (summary: string) => summary.split('\n');
const lineIndex = (summary: string, needle: string): number => {
  const i = linesOf(summary).findIndex((line) => line.includes(needle));
  if (i < 0) throw new Error(`"${needle}" not in summary:\n${summary}`);
  return i;
};
const indentOf = (line: string): number => line.length - line.trimStart().length;

describe('summaryOf — header with derived diagnostics', () => {
  it('derived errors do not count as errors: "1 error (+2 derivados), 1 warning, 0 info"', () => {
    const summary = summaryOf([title, cause, warning, cards]);
    expect(linesOf(summary)[0]).toBe('Diagnósticos: 1 error (+2 derivados), 1 warning, 0 info');
  });

  it('without derived diagnostics the header is unchanged', () => {
    const summary = summaryOf([cause, warning, diag('info', 'Slide > Text[4]')]);
    expect(linesOf(summary)[0]).toBe('Diagnósticos: 1 error, 1 warning, 1 info');
    expect(summary).not.toContain('derivados');
    expect(summary).not.toContain('↳');
  });
});

describe('summaryOf — derived listed under their cause', () => {
  // Ordem de entrada embaralhada de propósito: o derivado vem antes da causa.
  const summary = summaryOf([title, warning, cause, cards]);

  it('every derived diagnostic appears after its cause and before the next non-derived one', () => {
    const c = lineIndex(summary, `em ${CAUSE}`);
    const t = lineIndex(summary, 'em Slide > Text[0]');
    const k = lineIndex(summary, 'em Slide > Box > Box[0..7] > Text');
    expect(t).toBeGreaterThan(c);
    expect(k).toBeGreaterThan(c);
    const w = lineIndex(summary, 'em Slide > Text[3]');
    // o aviso solto não pode ficar entre a causa e os seus derivados
    expect(w < c || w > Math.max(t, k)).toBe(true);
  });

  it('derived lines carry ↳ and extra indentation; the cause line does not', () => {
    const lines = linesOf(summary);
    const causeLine = lines[lineIndex(summary, `em ${CAUSE}`)]!;
    expect(causeLine).not.toContain('↳');
    for (const needle of ['em Slide > Text[0]', 'em Slide > Box > Box[0..7] > Text']) {
      const line = lines[lineIndex(summary, needle)]!;
      expect(line).toContain('↳');
      expect(indentOf(line)).toBeGreaterThan(indentOf(causeLine));
    }
  });

  it('derived messages are still printed', () => {
    expect(summary).toContain('derivado Slide > Text[0]');
    expect(summary).toContain('derivado Slide > Box > Box[0..7] > Text');
    expect(summary).toContain('causa: parágrafo enorme');
  });

  it('every diagnostic is printed exactly once', () => {
    for (const needle of [`em ${CAUSE}`, 'em Slide > Text[0]', 'em Slide > Box > Box[0..7] > Text', 'em Slide > Text[3]'])
      expect(linesOf(summary).filter((line) => line.includes(needle)), needle).toHaveLength(1);
  });
});

describe('summaryOf — derived whose cause is not in the list', () => {
  const orphan = derived('Slide > Text[0]', 'Slide > Text[9]');

  it('is printed in its normal place (no ↳) but still counts as derived', () => {
    const summary = summaryOf([warning, orphan, diag('info', 'Slide > Text[4]')]);
    expect(linesOf(summary)[0]).toBe('Diagnósticos: 0 error (+1 derivado), 1 warning, 1 info');
    const w = lineIndex(summary, 'em Slide > Text[3]');
    const o = lineIndex(summary, 'em Slide > Text[0]');
    const i = lineIndex(summary, 'em Slide > Text[4]');
    expect(w).toBeLessThan(o);
    expect(o).toBeLessThan(i);
    expect(linesOf(summary)[o]).not.toContain('↳');
    expect(summary).toContain('derivado Slide > Text[0]');
  });
});

describe('exitCodeOf — derived errors still fail the build', () => {
  it('only derived errors → 1', () => {
    expect(exitCodeOf([title, cards])).toBe(1);
  });

  it('cause + derived → 1; only warnings → 0', () => {
    expect(exitCodeOf([cause, title])).toBe(1);
    expect(exitCodeOf([warning])).toBe(0);
  });
});

describe('summaryOf — the cause is a Box without its own diagnostic', () => {
  // A causa aponta para o contêiner; o estouro real está num Text dentro dele.
  const boxCause = diag('error', 'Slide > Box > Text', { message: 'parágrafo gigante' });
  const titleDerived = diag('error', 'Slide > Text', {
    message: 'título espremido',
    data: { overflowPt: 5, overflowPct: 40, causedBy: 'Slide > Box' },
  });

  it('derived printed with ↳ right below the first non-derived diagnostic inside the Box; header "1 error (+1 derivado)"', () => {
    const summary = summaryOf([titleDerived, boxCause]);
    const lines = linesOf(summary);
    expect(lines[0]).toBe('Diagnósticos: 1 error (+1 derivado), 0 warning, 0 info');
    const c = lineIndex(summary, 'em Slide > Box > Text');
    const t = lineIndex(summary, 'em Slide > Text');
    expect(t).toBeGreaterThan(c);
    expect(lines[t]).toContain('↳');
    expect(lines[c]).not.toContain('↳');
    // logo abaixo: entre a causa e o derivado só a linha de mensagem da causa
    expect(lines.slice(c + 1, t).every((line) => !/[✖▲•] \[/.test(line))).toBe(true);
  });

  it('two diagnostics inside the Box: the anchor is the first non-derived one', () => {
    const second = diag('warning', 'Slide > Box > Text[1]', { message: 'segundo dentro do Box' });
    const first = diag('error', 'Slide > Box > Text[0]', { message: 'primeiro dentro do Box' });
    const summary = summaryOf([titleDerived, first, second]);
    const lines = linesOf(summary);
    const a = lineIndex(summary, 'em Slide > Box > Text[0]');
    const t = lineIndex(summary, 'em Slide > Text');
    const b = lineIndex(summary, 'em Slide > Box > Text[1]');
    expect(t).toBeGreaterThan(a);
    expect(t).toBeLessThan(b);
    expect(lines[t]).toContain('↳');
  });

  it('an exact path match wins over a diagnostic inside the cause', () => {
    const inside = diag('error', 'Slide > Box > Text', { message: 'dentro' });
    const exact = diag('error', 'Slide > Box', { code: 'box-overflow', message: 'o próprio Box' });
    const summary = summaryOf([inside, titleDerived, exact]);
    const lines = linesOf(summary);
    const exactLine = lines.findIndex((line) => line.endsWith('em Slide > Box'));
    const t = lineIndex(summary, 'em Slide > Text');
    expect(exactLine).toBeGreaterThanOrEqual(0);
    expect(t).toBeGreaterThan(exactLine);
    expect(lines.slice(exactLine + 1, t).every((line) => !/[✖▲•] \[/.test(line))).toBe(true);
  });
});
