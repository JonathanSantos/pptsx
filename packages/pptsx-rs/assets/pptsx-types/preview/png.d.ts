export interface PngOptions {
    readonly widthPx: number;
    readonly fontFiles: readonly string[];
}
/** Primeira família dos arquivos: resvg sem fontes do sistema não tem outro fallback. */
export declare const defaultFamilyOf: (fontFiles: readonly string[]) => string | undefined;
/**
 * Sem fontes do sistema o preview é determinístico: renderiza igual em
 * qualquer máquina, só com as fontes registradas no deck.
 */
export declare const rasterize: (svg: string, fontFiles: readonly string[], widthPx?: number) => Buffer;
export declare const svgToPng: (svg: string, options: PngOptions) => Buffer;
