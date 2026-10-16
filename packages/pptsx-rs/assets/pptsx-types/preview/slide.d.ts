import type { PositionedSlide, SlideSize } from '../core/types.ts';
/**
 * Preview SVG do slide (M11): a mesma ordem de pintura do emissor (`paintOrderOf`) e a mesma
 * pintura CSS (fundo, bordas, sombra, opacidade, rotação). O preview é do .pptx: o que não sai
 * no arquivo (css-not-emitted) também não é desenhado.
 */
export interface SvgOptions {
    readonly widthPx: number;
    readonly debug?: boolean;
    readonly baseDir: string;
    /** família lógica → nome interno da fonte que o resvg conhece (ex.: Arial → Liberation Sans) */
    readonly fontFamilyMap?: Readonly<Record<string, string>>;
    /** leitura de arquivo injetável (padrão fs.readFileSync) para manter o SVG testável */
    readonly readFile?: (path: string) => Buffer;
    /** Idioma dos números do gráfico (separador decimal); padrão DEFAULTS.lang. */
    readonly lang?: string;
}
export declare const slideToSvg: (slide: PositionedSlide, size: SlideSize, options: SvgOptions) => string;
