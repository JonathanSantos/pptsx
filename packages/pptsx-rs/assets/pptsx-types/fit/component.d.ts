import type { Diagnostic, PositionedSlide } from '../core/types.ts';
/** path → source do componente mais próximo, para todo nó do slide dentro de algum componente. */
export declare const componentSourcesOf: (slide: PositionedSlide) => ReadonlyMap<string, string>;
export declare const attributeComponents: (diagnostics: readonly Diagnostic[], slide: PositionedSlide) => readonly Diagnostic[];
