import type { FontFace } from '../core/types.ts';
import type { FileFontFace } from './system.ts';
/** Liberation Sans tem métricas de Arial: mede-se com ela e emite-se "Arial". */
export declare const DEFAULT_FONTS: readonly FileFontFace[];
/**
 * Família lógica → nome interno do arquivo. O resvg só conhece o nome interno
 * ("Liberation Sans"), enquanto o deck e o PPTX usam o lógico ("Arial").
 * Faces sem `file` (não resolvidas) ficam de fora.
 */
export declare const fontFamilyMapOf: (faces: readonly FontFace[]) => Readonly<Record<string, string>>;
export { createSystemFontIndex, defaultFontDirs, findSystemFont, fontLabelOf, normalizeFamily, resolveFontFaces, type FileFontFace, type ResolvedFontFaces, type SystemFontEntry, type SystemFontIndex, } from './system.ts';
export { eotOf, fsTypeOf, isEmbeddable, isTrueTypeFont } from './eot.ts';
/** M17: as faces padrão (Liberation Sans registrada como Arial), para uma config somar às suas. */
export declare const defaultFontFaces: () => readonly FileFontFace[];
/** M17: arquivos das faces padrão (Liberation Sans, métricas de Arial), para quem rasteriza fora do render. */
export declare const defaultFontFiles: () => readonly string[];
