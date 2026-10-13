import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import type { FontFace } from './core/types.ts';

const fontFile = (name: string): string => fileURLToPath(new URL(`../fonts/${name}`, import.meta.url));

/** Liberation Sans tem métricas de Arial: mede-se com ela e emite-se "Arial". */
export const DEFAULT_FONTS: readonly FontFace[] = [
  { family: 'Arial', weight: 'regular', file: fontFile('LiberationSans-Regular.ttf') },
  { family: 'Arial', weight: 'bold', file: fontFile('LiberationSans-Bold.ttf') },
  { family: 'Arial', weight: 'regular', italic: true, file: fontFile('LiberationSans-Italic.ttf') },
  { family: 'Arial', weight: 'bold', italic: true, file: fontFile('LiberationSans-BoldItalic.ttf') },
];

const internalFamilyOf = (file: string): string => {
  const font = fontkit.openSync(file);
  return 'familyName' in font ? font.familyName : '';
};

/**
 * Família lógica → nome interno do arquivo. O resvg só conhece o nome interno
 * ("Liberation Sans"), enquanto o deck e o PPTX usam o lógico ("Arial").
 */
export const fontFamilyMapOf = (faces: readonly FontFace[]): Readonly<Record<string, string>> =>
  Object.fromEntries(faces.map((face) => [face.family, internalFamilyOf(face.file)]));
