import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import type { FontFace } from '../core/types.ts';
import { standaloneRuntime } from '../standalone.ts';
import type { FileFontFace } from './system.ts';

// No bundle de arquivo único as fontes vêm embutidas e são gravadas numa pasta de cache (M18-7).
const fontFile = (name: string): string => {
  const runtime = standaloneRuntime();
  return runtime === undefined ? fileURLToPath(new URL(`../../fonts/${name}`, import.meta.url)) : join(runtime.fontDir, name);
};

/** Liberation Sans tem métricas de Arial: mede-se com ela e emite-se "Arial". */
export const DEFAULT_FONTS: readonly FileFontFace[] = [
  { family: 'Arial', weight: 'regular', file: fontFile('LiberationSans-Regular.ttf') },
  { family: 'Arial', weight: 'bold', file: fontFile('LiberationSans-Bold.ttf') },
  { family: 'Arial', weight: 'regular', italic: true, file: fontFile('LiberationSans-Italic.ttf') },
  { family: 'Arial', weight: 'bold', italic: true, file: fontFile('LiberationSans-BoldItalic.ttf') },
];

// Com postscriptName o fontkit devolve a face daquela coleção (ou null se não existir: cai na 1ª).
// M13: a família tipográfica (name ID 16) agrupa os pesos ("Inter" para Inter SemiBold); sem ela, a ID 1.
const internalFamilyOf = (face: FileFontFace): string => {
  const selected: fontkit.Font | fontkit.FontCollection | null = face.postscriptName
    ? fontkit.openSync(face.file, face.postscriptName)
    : null;
  const loaded = selected ?? fontkit.openSync(face.file);
  const font = 'fonts' in loaded ? loaded.fonts[0] : loaded;
  if (font === undefined) return '';
  return font.getName('preferredFamily', 'en') ?? font.familyName;
};

const hasFile = (face: FontFace): face is FileFontFace => face.file !== undefined;

/**
 * Família lógica → nome interno do arquivo. O resvg só conhece o nome interno
 * ("Liberation Sans"), enquanto o deck e o PPTX usam o lógico ("Arial").
 * Faces sem `file` (não resolvidas) ficam de fora.
 */
export const fontFamilyMapOf = (faces: readonly FontFace[]): Readonly<Record<string, string>> =>
  Object.fromEntries(
    faces
      .filter(hasFile)
      // A 1ª face de cada família vence (é a que o deck lista primeiro, em geral a regular).
      .filter((face, index, all) => all.findIndex((other) => other.family === face.family) === index)
      .map((face) => [face.family, internalFamilyOf(face)]),
  );

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

/** M17: as faces padrão (Liberation Sans registrada como Arial), para uma config somar às suas. */
export const defaultFontFaces = (): readonly FileFontFace[] => DEFAULT_FONTS;

/** M17: arquivos das faces padrão (Liberation Sans, métricas de Arial), para quem rasteriza fora do render. */
export const defaultFontFiles = (): readonly string[] => DEFAULT_FONTS.flatMap((face) => (face.file === undefined ? [] : [face.file]));
