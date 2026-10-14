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

/**
 * Escolhe a face dentro do arquivo carregado. Coleção (.ttc/.dfont, como as fontes do
 * macOS): a face de `postscriptName`, ou a 1ª sem ele. Arquivo de face única: ela mesma.
 * Não se usa `openSync(file, postscriptName)` direto porque, num .ttf comum, o fontkit
 * trata o nome como instância de fonte variável e lança erro.
 */
const faceOf = (loaded: fontkit.Font | fontkit.FontCollection, file: string, postscriptName?: string): fontkit.Font => {
  if (!isCollection(loaded)) return loaded;
  if (postscriptName === undefined) {
    const [first] = loaded.fonts;
    if (first === undefined) throw new Error(`Coleção de fontes vazia: ${file}`);
    return first;
  }
  const named = loaded.getFont(postscriptName);
  if (named === null) throw new Error(`Face "${postscriptName}" não existe na coleção ${file}`);
  return named;
};

/** Chave do cache de faces carregadas: o mesmo arquivo pode ter várias faces (coleção). */
const fontKeyOf = (file: string, postscriptName?: string): string => `${file}#${postscriptName ?? ''}`;

interface FaceSource {
  readonly file: string;
  readonly postscriptName?: string;
}

const describe = (face: FontFace): string =>
  [face.family, face.weight, ...(face.italic === true ? ['italic'] : [])].join(' ');

// Achar a face no sistema é do módulo src/fonts (resolveFontFaces); aqui só se carrega arquivo.
const sourceOf = (face: FontFace): FaceSource => {
  if (face.file === undefined) {
    throw new Error(`FontFace sem file: resolva com resolveFontFaces antes (${describe(face)})`);
  }
  return face.postscriptName === undefined ? { file: face.file } : { file: face.file, postscriptName: face.postscriptName };
};

/** Cada arquivo é aberto uma vez; cada face (arquivo + postscriptName) é extraída uma vez. */
const loadFaces = (sources: readonly FaceSource[]): ReadonlyMap<string, fontkit.Font> => {
  const files = [...new Set(sources.map((source) => source.file))];
  const loadedByFile = new Map(files.map((file) => [file, fontkit.openSync(file)]));
  const unique = new Map(sources.map((source) => [fontKeyOf(source.file, source.postscriptName), source]));
  return new Map(
    [...unique].map(([key, { file, postscriptName }]) => {
      const loaded = loadedByFile.get(file);
      if (loaded === undefined) throw new Error(`Fonte não carregada: ${file}`);
      return [key, faceOf(loaded, file, postscriptName)];
    }),
  );
};

/** Carrega cada arquivo uma única vez (IO na borda); `get` é só consulta em memória. */
export const createFontRegistry = (faces: readonly FontFace[]): FontRegistry => {
  const sources = faces.map(sourceOf);
  const fontByFace = loadFaces(sources);
  const faceKeyByStyle: ReadonlyMap<string, string> = new Map(
    faces.map((face, index) => {
      const source = sources[index];
      return [keyOf(face.family, face.weight, face.italic ?? false), source ? fontKeyOf(source.file, source.postscriptName) : ''];
    }),
  );
  const fontOfKey = (key: string): fontkit.Font | undefined => {
    const faceKey = faceKeyByStyle.get(key);
    return faceKey === undefined ? undefined : fontByFace.get(faceKey);
  };

  const get = (family: string, weight: FontWeight, italic: boolean): fontkit.Font | undefined => {
    const exact = fontOfKey(keyOf(family, weight, italic));
    if (exact !== undefined || !italic) return exact;
    // Itálico ausente cai para a face reta do mesmo peso: mede-se igual o bastante e não é "fonte faltando".
    return fontOfKey(keyOf(family, weight, false));
  };

  return { faces, get };
};
