import type { FontFace, FontWeight } from '../core/types.ts';
/** Face já com arquivo: é o que o registro, o preview e o embed consomem. */
export type FileFontFace = FontFace & {
    readonly file: string;
};
export interface SystemFontEntry {
    /** Família normalizada (minúsculas, espaços colapsados). */
    readonly family: string;
    readonly bold: boolean;
    readonly italic: boolean;
    /** OS/2.usWeightClass; desempata faces do mesmo grupo (ex.: Medium vs Regular). */
    readonly weightClass: number;
    readonly file: string;
    /** Nome PostScript da face: seleciona a face certa dentro de uma coleção (.ttc). */
    readonly postscriptName?: string;
    /** Face de .ttc: o registro só carrega a 1ª face da coleção, então perde no desempate. */
    readonly collection: boolean;
}
export interface SystemFontIndex {
    readonly entries: readonly SystemFontEntry[];
}
export interface ResolvedFontFaces {
    readonly faces: readonly FileFontFace[];
    /** "Inter bold italic": família como o autor escreveu, peso e itálico. */
    readonly missing: readonly string[];
}
export declare const normalizeFamily: (family: string) => string;
export declare const fontLabelOf: (face: Pick<FontFace, 'family' | 'weight' | 'italic'>) => string;
/** Pastas de fontes por plataforma; parâmetros injetáveis para teste. */
export declare const defaultFontDirs: (platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv, home?: string) => readonly string[];
/** Varre as pastas uma vez por processo (cache por lista de pastas): IO só aqui. */
export declare const createSystemFontIndex: (dirs?: readonly string[]) => SystemFontIndex;
export declare const findSystemFont: (index: SystemFontIndex, family: string, weight: FontWeight, italic: boolean) => SystemFontEntry | undefined;
/**
 * Completa `file` das faces pelo índice do sistema. Só varre as pastas se alguma face
 * não tiver arquivo; as não achadas saem em `missing` (o `font-missing` por nó vem do fit).
 */
export declare const resolveFontFaces: (faces: readonly FontFace[], index?: SystemFontIndex) => ResolvedFontFaces;
