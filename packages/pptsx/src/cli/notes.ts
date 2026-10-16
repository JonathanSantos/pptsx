import { format } from 'node:util';
import type { Diagnostic, RenderResult } from '../core/types.ts';

/**
 * 1.0.5: um `console.warn`/`console.error` de um módulo do deck ou do design system (um ícone com nome
 * desconhecido, por exemplo) não pode sumir no terminal: durante a carga e o render ele é recolhido e vira
 * o diagnóstico `module-warning` (warning, slide 0) em cada tamanho. `console.log` segue para o stdout.
 * Igual ao pptsx-rs (`Interp.notes`). Borda de IO: só a CLI e o MCP usam.
 */

export const MODULE_WARNING_SUFFIX = ' (aviso de um módulo do deck ou do design system, via console.warn)';

export interface Captured<T> {
  readonly value: T;
  /** Na ordem da primeira ocorrência, sem repetir. */
  readonly notes: readonly string[];
}

type ConsoleMethod = (...args: unknown[]) => void;

/** Roda `run` com `console.warn` e `console.error` recolhidos (texto como o console imprimiria); restaura sempre. */
export const captureNotes = async <T>(run: () => Promise<T>): Promise<Captured<T>> => {
  const notes: string[] = [];
  const note: ConsoleMethod = (...args) => {
    const text = format(...args);
    if (!notes.includes(text)) notes.push(text);
  };
  const previous = { warn: console.warn, error: console.error };
  console.warn = note;
  console.error = note;
  try {
    return { value: await run(), notes };
  } finally {
    console.warn = previous.warn;
    console.error = previous.error;
  }
};

export const moduleWarningOf = (size: string, note: string): Diagnostic => ({
  severity: 'warning',
  code: 'module-warning',
  size,
  slide: 0,
  path: '',
  message: `${note}${MODULE_WARNING_SUFFIX}`,
});

/** Os avisos entram em todos os tamanhos (o módulo é um só; o render dos tamanhos é uma passada). */
export const withModuleWarnings = (results: readonly RenderResult[], notes: readonly string[]): readonly RenderResult[] =>
  notes.length === 0 ? results : results.map((result) => ({ ...result, diagnostics: [...result.diagnostics, ...notes.map((note) => moduleWarningOf(result.size, note))] }));
