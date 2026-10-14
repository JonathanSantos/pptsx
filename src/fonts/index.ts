import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import type { FontFace } from '../core/types.ts';
import type { FileFontFace } from './system.ts';

const fontFile = (name: string): string => fileURLToPath(new URL(`../../fonts/${name}`, import.meta.url));

/** Liberation Sans tem métricas de Arial: mede-se com ela e emite-se "Arial". */
export const DEFAULT_FONTS: readonly FileFontFace[] = [
  { family: 'Arial', weight: 'regular', file: fontFile('LiberationSans-Regular.ttf') },
  { family: 'Arial', weight: 'bold', file: fontFile('LiberationSans-Bold.ttf') },
  { family: 'Arial', weight: 'regular', italic: true, file: fontFile('LiberationSans-Italic.ttf') },
  { family: 'Arial', weight: 'bold', italic: true, file: fontFile('LiberationSans-BoldItalic.ttf') },
];

// Com postscriptName o fontkit devolve a face daquela coleção (ou null se não existir: cai na 1ª).
const internalFamilyOf = (face: FileFontFace): string => {
  const selected: fontkit.Font | fontkit.FontCollection | null = face.postscriptName
    ? fontkit.openSync(face.file, face.postscriptName)
    : null;
  const loaded = selected ?? fontkit.openSync(face.file);
  return 'fonts' in loaded ? (loaded.fonts[0]?.familyName ?? '') : loaded.familyName;
};

const hasFile = (face: FontFace): face is FileFontFace => face.file !== undefined;

/**
 * Família lógica → nome interno do arquivo. O resvg só conhece o nome interno
 * ("Liberation Sans"), enquanto o deck e o PPTX usam o lógico ("Arial").
 * Faces sem `file` (não resolvidas) ficam de fora.
 */
export const fontFamilyMapOf = (faces: readonly FontFace[]): Readonly<Record<string, string>> =>
  Object.fromEntries(faces.filter(hasFile).map((face) => [face.family, internalFamilyOf(face)]));

export {
  createSystemFontIndex,
  defaultFontDirs,
  findSystemFont,
  fontLabelOf,
  normalizeFamily,
  resolveFontFaces,
  type FileFontFace,
  type ResolvedFontFaces,
  type SystemFontEntry,
  type SystemFontIndex,
} from './system.ts';
export { eotOf, fsTypeOf, isEmbeddable, isTrueTypeFont } from './eot.ts';
