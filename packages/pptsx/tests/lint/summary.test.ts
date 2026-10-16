import { describe, expect, it } from 'vitest';
import { isInsideComponent, lintSummaryOf, type LintFinding } from '../../src/lint/lint.ts';

/** 1.0.5 (CONTRACTS §lint "Resumo"): info de dentro de componentes de DS sai numa linha só; --json não muda. */

const finding = (severity: LintFinding['severity'], path: string, code = 'off-theme-color'): LintFinding => ({ severity, code, size: '16x9', slide: 1, path, message: `m ${path}` });

describe('isInsideComponent', () => {
  it.each([
    ['Slide > Box > Text', false],
    ['Slide > Box[2] > Footer > Text', false],
    ['ContentLayout > Box > Text', true],
    ['Slide > Risks > Box[0] > Text[1]', true],
    ['Slide > Fixed > SlideNumber', false],
  ])('%s → %s', (path, expected) => {
    expect(isInsideComponent(path)).toBe(expected);
  });
});

describe('lintSummaryOf', () => {
  it('dobra os info de dentro de componentes numa linha com a contagem e os códigos; os demais saem como antes', () => {
    const summary = lintSummaryOf([
      finding('info', 'Slide > Risks > Box > Text'),
      finding('info', 'Slide > Risks > Box > Text[1]', 'keynote-line-height'),
      finding('info', 'Slide > Text'),
      finding('warning', 'Slide > Kpi > Text', 'css-not-emitted'),
    ]);
    const lines = summary.split('\n');
    expect(lines[0]).toBe('Lint: 0 error, 1 warning, 3 info');
    expect(lines[1]).toBe('  • 2 info dentro de componentes de design system (keynote-line-height, off-theme-color): são do DS, não do deck; --json lista todos');
    expect(summary).toContain('▲ [16x9 · slide 1] css-not-emitted em Slide > Kpi > Text');
    expect(summary).toContain('• [16x9 · slide 1] off-theme-color em Slide > Text');
    expect(summary).not.toContain('em Slide > Risks');
  });

  it('sem info dentro de componentes, nenhuma linha de dobra', () => {
    expect(lintSummaryOf([finding('info', 'Slide > Text')])).not.toContain('dentro de componentes');
    expect(lintSummaryOf([])).toBe('Lint: nada a apontar.');
  });
});
