import { describe, expect, it } from 'vitest';
import { MODULE_WARNING_SUFFIX, captureNotes, moduleWarningOf, withModuleWarnings } from '../../src/cli/notes.ts';
import type { RenderResult } from '../../src/core/types.ts';

/** 1.0.5 (CONTRACTS §cli "module-warning"): console.warn/error de um módulo do deck vira diagnóstico. */

describe('captureNotes', () => {
  it('recolhe console.warn e console.error formatados como o console, sem repetir, e restaura o console', async () => {
    const warn = console.warn;
    const error = console.error;
    const { value, notes } = await captureNotes(async () => {
      console.warn('ds: ícone "%s" desconhecido', 'xyz');
      console.error('falhou', 42);
      console.warn('ds: ícone "%s" desconhecido', 'xyz');
      return 'ok';
    });
    expect(value).toBe('ok');
    expect(notes).toEqual(['ds: ícone "xyz" desconhecido', 'falhou 42']);
    expect(console.warn).toBe(warn);
    expect(console.error).toBe(error);
  });

  it('restaura o console mesmo quando run lança', async () => {
    const warn = console.warn;
    await expect(captureNotes(async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(console.warn).toBe(warn);
  });
});

describe('moduleWarningOf / withModuleWarnings', () => {
  const result = (size: string): RenderResult => ({ size, buffer: Buffer.alloc(0), diagnostics: [] });

  it('warning no slide 0, path vazio, mensagem com o sufixo que diz de onde veio', () => {
    expect(moduleWarningOf('16x9', 'nota')).toEqual({ severity: 'warning', code: 'module-warning', size: '16x9', slide: 0, path: '', message: `nota${MODULE_WARNING_SUFFIX}` });
  });

  it('entra em todos os tamanhos, depois dos diagnósticos do render; sem notas, os resultados saem iguais', () => {
    const results = [result('16x9'), result('4x3')];
    expect(withModuleWarnings(results, [])).toBe(results);
    const withNotes = withModuleWarnings(results, ['a', 'b']);
    expect(withNotes.map((r) => r.diagnostics.map((d) => [d.size, d.code, d.slide]))).toEqual([
      [['16x9', 'module-warning', 0], ['16x9', 'module-warning', 0]],
      [['4x3', 'module-warning', 0], ['4x3', 'module-warning', 0]],
    ]);
  });
});
