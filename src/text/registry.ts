import * as fontkit from 'fontkit';
import type { FontFace, FontWeight } from '../core/types.ts';

export interface FontRegistry {
  readonly faces: readonly FontFace[];
  readonly get: (family: string, weight: FontWeight, italic: boolean) => fontkit.Font | undefined;
}

// Família comparada sem caixa e sem espaços nas pontas: 'arial' e 'Arial ' são a mesma face.
const keyOf = (family: string, weight: FontWeight, italic: boolean): string =>
  `${family.trim().toLowerCase()}|${weight}|${italic ? 'italic' : 'normal'}`;

const isCollection = (loaded: fontkit.Font | fontkit.FontCollection): loaded is fontkit.FontCollection =>
  'fonts' in loaded && Array.isArray(loaded.fonts);

// Coleções (.ttc/.dfont) não são esperadas; usa-se a primeira face para não falhar.
const loadFont = (file: string): fontkit.Font => {
  const loaded = fontkit.openSync(file);
  if (!isCollection(loaded)) return loaded;
  const [first] = loaded.fonts;
  if (first === undefined) throw new Error(`Coleção de fontes vazia: ${file}`);
  return first;
};

/** Carrega cada arquivo uma única vez (IO na borda); `get` é só consulta em memória. */
export const createFontRegistry = (faces: readonly FontFace[]): FontRegistry => {
  const fontByFile: ReadonlyMap<string, fontkit.Font> = new Map(
    [...new Set(faces.map((face) => face.file))].map((file) => [file, loadFont(file)]),
  );
  const fileByKey: ReadonlyMap<string, string> = new Map(
    faces.map((face) => [keyOf(face.family, face.weight, face.italic ?? false), face.file]),
  );
  const fontOfKey = (key: string): fontkit.Font | undefined => {
    const file = fileByKey.get(key);
    return file === undefined ? undefined : fontByFile.get(file);
  };

  const get = (family: string, weight: FontWeight, italic: boolean): fontkit.Font | undefined => {
    const exact = fontOfKey(keyOf(family, weight, italic));
    if (exact !== undefined || !italic) return exact;
    // Itálico ausente cai para a face reta do mesmo peso: mede-se igual o bastante e não é "fonte faltando".
    return fontOfKey(keyOf(family, weight, false));
  };

  return { faces, get };
};
