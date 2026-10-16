import type { Diagnostic, RenderResult } from '../core/types.ts';
/**
 * 1.0.5: um `console.warn`/`console.error` de um módulo do deck ou do design system (um ícone com nome
 * desconhecido, por exemplo) não pode sumir no terminal: durante a carga e o render ele é recolhido e vira
 * o diagnóstico `module-warning` (warning, slide 0) em cada tamanho. `console.log` segue para o stdout.
 * Igual ao pptsx-rs (`Interp.notes`). Borda de IO: só a CLI e o MCP usam.
 */
export declare const MODULE_WARNING_SUFFIX = " (aviso de um m\u00F3dulo do deck ou do design system, via console.warn)";
export interface Captured<T> {
    readonly value: T;
    /** Na ordem da primeira ocorrência, sem repetir. */
    readonly notes: readonly string[];
}
/** Roda `run` com `console.warn` e `console.error` recolhidos (texto como o console imprimiria); restaura sempre. */
export declare const captureNotes: <T>(run: () => Promise<T>) => Promise<Captured<T>>;
export declare const moduleWarningOf: (size: string, note: string) => Diagnostic;
/** Os avisos entram em todos os tamanhos (o módulo é um só; o render dos tamanhos é uma passada). */
export declare const withModuleWarnings: (results: readonly RenderResult[], notes: readonly string[]) => readonly RenderResult[];
