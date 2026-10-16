import type { CssStyle, Display, PrimitiveKind } from '../core/types.ts';
import type { InheritedText } from './draft.ts';
export interface Normalized {
    readonly css: CssStyle;
    /** Estilo de texto efetivo do nó (herdado + próprio). */
    readonly text: InheritedText;
    /** Props consumidas pela primitiva com os nomes da engine (src, data, fit, nowrap…). */
    readonly own: Readonly<Record<string, unknown>>;
}
export declare const normalizeProps: (kind: PrimitiveKind, props: Readonly<Record<string, unknown>>, parentText: InheritedText) => Normalized;
/**
 * `CssStyle` inicial de um Box sem props (ou com só `display`), igual ao que o resolve produz:
 * sem `display` é flex column; `'flex'` é row. Para montar nós à mão (testes, ferramentas).
 */
export declare const initialCss: (display?: Display) => CssStyle;
