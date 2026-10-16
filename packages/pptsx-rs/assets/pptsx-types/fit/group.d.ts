import type { Diagnostic } from '../core/types.ts';
/**
 * Pura: agrupa diagnósticos iguais de irmãos homônimos (mesmo size, slide, code,
 * severity e causedBy; paths iguais a menos do [i] de um único segmento). O grupo
 * fica na posição do primeiro membro; diagnósticos únicos saem como entraram.
 */
export declare const groupDiagnostics: (diagnostics: readonly Diagnostic[]) => readonly Diagnostic[];
