export interface StrictColor {
    readonly hex: string;
    readonly alpha: number;
}
/** Cor do autor ou InvalidPropError (nunca segue crua nem vira diagnóstico). */
export declare const strictColorOf: (property: string, value: unknown) => StrictColor;
export declare const hexOf: (property: string, value: unknown) => string;
/** Lista de cores (Chart `colors`); o índice entra no nome da prop do erro. */
export declare const hexListOf: (property: string, value: unknown) => readonly string[];
/** Objeto com campos de cor (Table `header`): só os campos listados são normalizados. */
export declare const withHexFields: <T>(property: string, value: T, fields: readonly string[]) => T;
/** M17: cor CSS (#RGB, #RRGGBB, rgb(), nome básico) → '#RRGGBB'; lança Error com o motivo. API pública. */
export declare const toHexColor: (value: unknown) => string;
